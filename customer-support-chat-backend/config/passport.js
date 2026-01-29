const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
      proxy: false,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, emails, photos } = profile;
        const email = emails[0].value;
        const avatarUrl = photos[0]?.value;

        let user = await User.findOne({
          where: {
            [require('sequelize').Op.or]: [
              { googleId: id },
              { email: email }
            ]
          }
        });

        if (user) {
          // Update googleId if not set
          if (!user.googleId) {
            user.googleId = id;
            if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
            await user.save();
          }
          return done(null, user);
        }

        // Create new user if doesn't exist
        user = await User.create({
          email,
          googleId: id,
          avatarUrl,
          isVerified: true, // Social login emails are usually verified
          userType: 'customer'
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: '/api/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'photos'],
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, emails, photos } = profile;
        const email = emails ? emails[0].value : `${id}@facebook.com`;
        const avatarUrl = photos[0]?.value;

        let user = await User.findOne({
          where: {
            [require('sequelize').Op.or]: [
              { facebookId: id },
              { email: email }
            ]
          }
        });

        if (user) {
          if (!user.facebookId) {
            user.facebookId = id;
            if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
            await user.save();
          }
          return done(null, user);
        }

        user = await User.create({
          email,
          facebookId: id,
          avatarUrl,
          isVerified: true,
          userType: 'customer'
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
