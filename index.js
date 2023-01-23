require('dotenv').config('.env');
const cors = require('cors');
const express = require('express');
const app = express();
const morgan = require('morgan');
const { PORT = 3000 } = process.env;
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
// TODO - require express-openid-connect and destructure auth from it
const { auth } = require('express-openid-connect');

const { User, Cupcake } = require('./db');
// middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
/* *********** YOUR CODE HERE *********** */
// follow the module instructions: destructure config environment variables from process.env
const {MY_SECRET, BASE_URL, AUTH0_CLIENT_ID, AUTH0_AUDIENCE} = process.env;

const setUser = async (req, res, next) => {
  const auth = req.header('Authorization');
  if (!auth) {
    next();
  }
  else {
    try {
      const [,token] = auth.split(' ');
      //console.log(token)
      const userObj = jwt.verify(token, JWT_SECRET);
      req.user = userObj
      next();
    } 
    catch(error) {
      res.sendStatus(401)
    } 
  }
}

// follow the docs:
  // define the config object
  const config = {
    authRequired: false,
    auth0Logout: true,
    secret: MY_SECRET,
    baseURL: BASE_URL,
    clientID: AUTH0_CLIENT_ID,
    issuerBaseURL: AUTH0_AUDIENCE
};
  // attach Auth0 OIDC auth router
app.use(auth(config));

app.use(async (req,res,next) => {
  const user = req.oidc.user
  //console.log(user)
   if(user) {
    const newUser = await User.findOrCreate({
     where: { username: user.nickname, name: user.name, email: user.email}
   });
   //console.log(newUser)
  }
    next()
})

//GET /me Route
app.get('/me', async (req,res, next) => {
  const me = await User.findOne({
     where: { username: req.oidc.user.nickname },
     raw: true
  })
  if(me){
   const token = jwt.sign(me, JWT_SECRET, { expiresIn: '1w' });
   //console.log(token)
   res.send({me, token})
  }         
});

app.get('/cupcakes', async (req, res, next) => {
 try {
   const cupcakes = await Cupcake.findAll();
   res.send(cupcakes);
 } catch (error) {
   console.error(error);
   next(error);
 }
});

app.post('/cupcakes',setUser, async (req, res, next) => {
 if(!req.user) {
   res.status(401).send('You must be logged in to create a cupcake!');
 } else {
   const {title, flavor, stars} = req.body
   const newCupcake = await Cupcake.create({title, flavor, stars, userId: req.user.id })
   res.send(newCupcake)
 }
})
// create a GET / route handler that sends back Logged in or Logged out
app.get('/', setUser, (req, res) => {
  res.send(req.oidc.isAuthenticated() ? `
    <h2 style="text-align: center">My Web App, Inc.</h2>
    <h2>Welcome, ${req.oidc.user.name}</h2>
    <p><b>Username: ${req.oidc.user.nickname}</b></p>
    <p>${req.oidc.user.email}</p>
    <img src="${req.oidc.user.picture}" alt="${req.oidc.user.name}"> ` 
    : 
    'Logged out')
});



// error handling middleware
app.use((error, req, res, next) => {
  console.error('SERVER ERROR: ', error);
  if(res.statusCode < 400) res.status(500);
  res.send({error: error.message, name: error.name, message: error.message});
});
app.listen(PORT, () => {
  console.log(`Cupcakes are ready at http://localhost:${PORT}`);
});
