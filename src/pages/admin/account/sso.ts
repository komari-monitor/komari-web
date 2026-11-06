// 账户绑定的单点登录：sso_id 形如「<平台>_<平台内 ID>」
export function getSSOInfo(ssoId: string | undefined) {
  if (!ssoId) return null;
  
  const [platform, uniqueId] = ssoId.split('_', 2);
  return {
    platform: platform || '',
    uniqueId: uniqueId || '',
    isBound: !!ssoId
  };
}

export function getSSODisplayName(platform: string) {
  switch (platform.toLowerCase()) {
    case 'github':
      return 'GitHub';
    case 'google':
      return 'Google';
    case 'gitlab':
      return 'GitLab';
    case 'discord':
      return 'Discord';
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1);
  }
}
