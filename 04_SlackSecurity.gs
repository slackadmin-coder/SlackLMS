/**
 * Backward-compatible Slack security facade.
 */
var SlackSecurity = {
  verify: function(parsed, config) {
    return SecurityService.verifySlackRequest(parsed, config);
  }
};
