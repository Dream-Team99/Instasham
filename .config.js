if(process.env.NODE_ENV === 'development') require('dotenv').load()

module.exports = {
  connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:5432/${process.env.DB_DATABASE}`,
}