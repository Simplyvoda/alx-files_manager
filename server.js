import express from 'express';
import routes from './routes/index.js';

const app = express();

const port = process.env.PORT || 5000;

// adding a middleware function
// app.use(express.json());

// load all routes from routes/index.js
app.use(routes);

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})