const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");
    console.log("Database:", connection.connection.name);
    console.log("Host:", connection.connection.host);
    return connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = connectDB;
