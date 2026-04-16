#!/bin/bash

# Generate a code summary with directory structure and important files
# Output file: code_summary.txt

OUTPUT_FILE="code_summary.txt"
DIRECTORIES=("backend" "frontend" "infra" "bin")

# Clear or create the output file
> "$OUTPUT_FILE"

echo "Generating code summary..." >&2

{
    echo "============================================"
    echo "CODE SUMMARY - Generated on $(date)"
    echo "============================================"
    echo ""
    
    for DIR in "${DIRECTORIES[@]}"; do
        if [ -d "$DIR" ]; then
            echo ""
            echo "========================================"
            echo "DIRECTORY STRUCTURE: $DIR"
            echo "========================================"
            tree "$DIR" -L 3 --charset ascii -I 'node_modules|.dist-info|psycopg|jwt|builds|.terraform|.venv' 2>/dev/null || find "$DIR" -type f \( -name "function.py" -o -name "db.py" -o -name "auth.py" -o -name "requirements.txt" -o -name "*.tf" -o -name "*.sh" -o -name "package.json" -o -name "*.md" \) ! -path "*/node_modules/*" ! -path "*/.dist-info/*" ! -path "*/psycopg/*" ! -path "*/jwt/*" ! -path "*/builds/*" ! -path "*/.venv/*" ! -path "*/.terraform/*" | head -50
            echo ""
        fi
    done
    
    echo ""
    echo "=========================================="
    echo "IMPORTANT FILES CONTENT"
    echo "=========================================="
    echo ""
    
    # Include root level important files
    for FILE in "README.md" "ENVIRONMENT.config"; do
        if [ -f "$FILE" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "FILE: $FILE"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            cat "$FILE"
            echo ""
        fi
    done
    
    for DIR in "${DIRECTORIES[@]}"; do
        if [ -d "$DIR" ]; then
            echo ""
            echo "--- Files from $DIR ---"
            echo ""
            
            # Find important files - ONLY service-level code
            find "$DIR" -type f \( -name "function.py" -o -name "db.py" -o -name "auth.py" -o -name "requirements.txt" -o -name "*.tf" ! -path "*/builds/*" ! -path "*/.terraform/*" -o -name "App.jsx" -o -name "package.json" \) ! -path "*/node_modules/*" ! -path "*/.dist-info/*" ! -path "*/psycopg/*" ! -path "*/jwt/*" ! -path "*/builds/*" ! -path "*/.venv/*" ! -path "*/.terraform/*" | sort | while read -r FILE; do
                if [ -f "$FILE" ]; then
                    # Skip very large files and binary distributions
                    SIZE=$(du -b "$FILE" | cut -f1)
                    if [ "$SIZE" -lt 500000 ]; then
                        echo ""
                        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                        echo "FILE: $FILE"
                        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                        cat "$FILE"
                        echo ""
                    fi
                fi
            done
        fi
    done
    
    echo ""
    echo "=========================================="
    echo "END OF CODE SUMMARY"
    echo "=========================================="

} >> "$OUTPUT_FILE"

echo "Code summary generated: $OUTPUT_FILE" >&2
wc -l "$OUTPUT_FILE" >&2
