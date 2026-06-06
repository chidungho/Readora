const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client();

const getGoogleClientId = () => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is required');
  }

  return process.env.GOOGLE_CLIENT_ID;
};

const verifyGoogleIdToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: getGoogleClientId(),
  });
  const payload = ticket.getPayload();

  if (!payload?.email || payload.email_verified === false) {
    throw new Error('Google account email is not verified');
  }

  return {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    avatar: payload.picture || '',
  };
};

module.exports = {
  verifyGoogleIdToken,
};
