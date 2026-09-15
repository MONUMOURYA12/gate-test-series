const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  try {
    const connection = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000, maxPoolSize: 20,
      autoIndex: process.env.NODE_ENV !== "production",
    });

    console.log("MongoDB connected successfully");
    return connection;
  } catch (error) {
    throw new Error("MongoDB connection failed. Check the database credential, TLS, and network access settings.");
  }
};

module.exports = connectDB;
