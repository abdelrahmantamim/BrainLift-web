const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: '*', // Allow all origins for development
  credentials: true
};

module.exports = {
  PORT,
  corsOptions
};