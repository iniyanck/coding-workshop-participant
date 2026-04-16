#!/bin/bash

OUTPUT_FILE="ai_context.xml"
# Target specific directories to avoid parsing the whole machine/root
DIRECTORIES=("backend" "frontend" "infra" "bin")

# 1. EXTENDED TRASH LIST: Ensure regex escapes for dots
IGNORE_DIRS="node_modules|\.git|\.venv|\.terraform|dist|build|__pycache__|psycopg|jwt|pytest|_pytest|pluggy|packaging|iniconfig|pytest_mock|\.pytest_cache|\.dist-info|\.libs"
IGNORE_FILES="package-lock\.json|yarn\.lock|\.DS_Store|.*\.pyc|.*\.zip|.*\.plan\.json|.*\.(svg|png|jpg|jpeg|ico|gif)|typing_extensions\.py|py\.py"

# 2. SOURCE EXTENSIONS
EXTENSIONS='py|jsx|js|ts|tsx|tf|sh|yml|yaml|json|md'

> "$OUTPUT_FILE"

echo "🧪 Compiling optimized AI context..." >&2

{
    # Wrap the entire output in an XML block for optimal LLM parsing
    echo "<project>"
    
    # --- ARCHITECTURE TREE ---
    # Gives the AI an understanding of your project's skeleton
    echo "  <architecture_tree>"
    for DIR in "${DIRECTORIES[@]}"; do
        if [ -d "$DIR" ]; then
            find "$DIR" -maxdepth 4 -not -path '*/\.*' | \
            grep -vE "($IGNORE_DIRS)" | grep -vE "($IGNORE_FILES)" | \
            sed -e "s/[^-][^\/]*\// |/g" -e "s/| [^\/]*$/|-- &/"
        fi
    done
    echo "  </architecture_tree>"

    # --- SOURCE CODE ---
    echo "  <source_code>"
    find "${DIRECTORIES[@]}" -type f -regextype posix-extended -regex ".*\.($EXTENSIONS)$" 2>/dev/null | \
    grep -vE "($IGNORE_DIRS|$IGNORE_FILES)" | while read -r FILE; do
        
        # Final safety check: skip known bloated/auto-generated files
        if [[ "$FILE" == *"typing_extensions.py"* ]]; then continue; fi

        # Use standard XML file tags. This allows an AI agent to easily target file paths for rewrites.
        echo "    <file path=\"$FILE\">"
        
        # Optimization: Use `cat -s` to compress multiple blank lines into a single blank line.
        # This saves tokens without breaking strings, destroying ASTs, or removing comments.
        cat -s "$FILE"
        
        echo "    </file>"
    done
    echo "  </source_code>"
    echo "</project>"
} >> "$OUTPUT_FILE"

echo "✅ Distillation complete! Context saved to $OUTPUT_FILE" >&2
echo "Final Size: $(du -h "$OUTPUT_FILE" | cut -f1)" >&2
echo "Total Lines: $(wc -l < "$OUTPUT_FILE")" >&2