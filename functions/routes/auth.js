/* eslint-disable promise/always-return */
const fs = require("fs");
const os = require("os");
const path = require("path");
const config = require("../util/config");
const express = require("express");
const firebase = require("firebase");
const routeGuard = require("../util/routeGuard");
const { admin, db } = require("../util/admin");

const { validateLoginData, validateSignUpData } = require("../util/validators");

//Initializing Express router
const router = express.Router();

//Initializing Firebase Authentication and setting up credentials
firebase.initializeApp(config);
const auth = firebase.auth()

//POST User login
router.post("/login", (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };

  const { valid, errors } = validateLoginData(user);
  if (!valid) return res.status(400).json({
    message:
      "Please confirm that all credentials are correct before trying to log in.",
  });

  auth
    .signInWithEmailAndPassword(user.email, user.password)
    .then((data) => {
      return data.user.getIdToken();
    })
    .then((token) => {
      return res.json({ token });
    })
    .catch((error) => {      
      console.error(error);
      if (error.code === "auth/user-not-found") {
        return res.status(400).json({ message: "There is no user record corresponding to this email. Please verify your credentials or signup." });
      } else if (error.code === "auth/wrong-password") {
        return res.status(400).json({ message: "The password is invalid for that email. Please try again!" });        
      } else {
        return res
          .status(500)
          .json({
            message:
              "Please confirm that all credentials are correct before trying to log in.",
          });
      }
    });
});

//POST User signup
router.post("/signup", (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
  };

  const { valid, errors } = validateSignUpData(newUser);

  if (!valid) return res.status(400).json({
    message:
      "Please confirm that all credentials are correct before trying to sign up.",
  });

  let token, userId;
  db.doc(`/users/${newUser.username}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res.status(400).json({
          message:
            "This username is already in use. Please provide another one.",
        });
      } else {
        return auth
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then((data) => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then((idtoken) => {
      token = idtoken;
      const userCredentials = {
        email: newUser.email,
        createdAt: new Date().toISOString(),
        userId,
      };
      return db.doc(`/users/${newUser.email}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch((error) => {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        return res.status(400).json({ message: "Email already in use" });
      } else {
        return res
          .status(500)
          .json({ message: "Something went wrong, please try again" });
      }
    });
});

//GET Get all user details
router.get("/profile", routeGuard, (req, res) => {
  let userData = {};
  db.doc(`/users/${req.user.username}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.userCredentials = doc.data();
        return res.status(200).json(userData);
      }
    })
    .catch((error) => {
      console.error(error);
      return res.status(500).json({ error: error.code });
    });
});

//POST Update user details
router.post("/profile/update", routeGuard, (req, res) => {
  let document = db.collection("users").doc(`${req.user.username}`);
  document
    .update(req.body)
    .then(() => {
      res.status(200).json({ message: "Profile updated successfully." });
    })
    .catch((error) => {
      console.error(error);
      return res.status(500).json({
        message: "Cannot update the profile.",
      });
    });
});

module.exports = router;
