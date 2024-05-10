import express from 'express';
import routes from './routes/index.js';

const app = express();

const port = process.env.PORT || 5000;

// load all routes from routes/index.js
const router = express.Router();
router.use('/', routes);
app.use(router);

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})