const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length < 2) {
      return null;
    }

    const payloadBase64 = tokenParts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(tokenParts[1].length / 4) * 4, '=');

    const payloadJson = atob(payloadBase64);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
};

export const hasValidToken = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    return false;
  }

  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    localStorage.removeItem('token');
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowInSeconds) {
    localStorage.removeItem('token');
    return false;
  }

  return true;
};
