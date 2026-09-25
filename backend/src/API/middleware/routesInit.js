import { authenticate } from "./auth.middlewere";

const routesInit = (app, passport, googleAuthEnabled = true) => {
  // Environment check
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendURL = isProduction ? process.env.FRONTEND_URL : "http://localhost:3000";

  if (googleAuthEnabled) {
    app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

    app.get("/auth/google/callback",
      passport.authenticate("google", {
        failureRedirect: `${frontendURL}/login?error=auth_failed`,
      }),
      (req, res) => {
        console.log("User authenticated successfully:", req.user);
        res.redirect(`${frontendURL}/profile`);
      }
    );
  } else {
    const oauthNotConfigured = (req, res) => {
      res.status(503).json({
        error: "Google OAuth is not configured on the backend.",
        requiredEnvironmentVariables: [
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "GOOGLE_REDIRECT_URL",
        ],
      });
    };

    app.get("/auth/google", oauthNotConfigured);
    app.get("/auth/google/callback", oauthNotConfigured);
  }

  // Protected User Route
  app.get("/user", authenticate, (req, res) => {
    res.send("<h3>User is authenticated</h3><a href='" + frontendURL + "/profile'>Profile</a>");
  });
};

export { routesInit };
