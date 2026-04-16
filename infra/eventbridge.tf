resource "aws_cloudwatch_event_rule" "every_five_minutes" {
  count               = data.aws_caller_identity.this.id != "000000000000" ? 1 : 0
  name                = "${var.aws_project}-hris-sync-rule-${local.app_id}"
  description         = "Fires every 5 minutes to trigger the HRIS employee sync"
  schedule_expression = "rate(5 minutes)"
  tags                = local.app_tags
}

resource "aws_cloudwatch_event_target" "sync_lambda_target" {
  count     = data.aws_caller_identity.this.id != "000000000000" ? 1 : 0
  rule      = aws_cloudwatch_event_rule.every_five_minutes[0].name
  target_id = "EmployeeSyncServiceLambda"
  arn       = module.lambda["employee-sync-service"].lambda_function_arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  count         = data.aws_caller_identity.this.id != "000000000000" ? 1 : 0
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda["employee-sync-service"].lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_five_minutes[0].arn
}
