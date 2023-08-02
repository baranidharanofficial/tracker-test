import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getMessaging } from "firebase-admin/messaging";
import express, { json } from "express";
import cors from "cors";
import mongoose from 'mongoose';
import schedule from 'node-schedule';
import cheerio from 'cheerio';
import axios from 'axios';
import bcrypt from 'bcrypt';

process.env.GOOGLE_APPLICATION_CREDENTIALS;

const app = express();
app.use(express.json());

// MongoDB connection (Replace 'your-mongodb-connection-string' with your actual connection string)
mongoose.connect('mongodb+srv://baranidharanofficial:5U29QvB6eoghs7Da@training.liykfwa.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.use(
    cors({
        origin: "*",
    })
);

app.use(
    cors({
        methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
    })
);

app.use(function (req, res, next) {
    res.setHeader("Content-Type", "application/json");
    next();
});

initializeApp({
    credential: applicationDefault(),
    projectId: 'test-9b907',
});

// Task schema and model
const alertSchema = new mongoose.Schema({
    url: { type: String, required: true },
    price: { type: String, required: true },
    user_id: { type: String, required: false },
    fcm_token: { type: String, required: false },
});

// Task schema and model
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fcm_token: { type: String, required: false },
});

const Alert = mongoose.model('Alert', alertSchema);

const User = mongoose.model('User', userSchema);


schedule.scheduleJob('*/30 * * * * *', async () => {
    console.log("Getting current price");

    const alerts = await Alert.find();

    for (let i = 0; i < alerts.length; i++) {
        console.log(alerts[i].url);
        axios.get(alerts[i].url).then(({ data }) => {
            const $ = cheerio.load(data);
            let strPrice = $('.a-offscreen', '#apex_desktop').html();
            const currentPrice = parseFloat(strPrice.split(',').join("").slice(1));

            console.log(currentPrice, alerts[i].price, strPrice, strPrice.split(',').join(""));

            if (currentPrice == alerts[i].price) {
                console.log("Equal Price");
                sendNotification(alerts[i].url, alerts[i].fcm_token);
            } else if (currentPrice > alerts[i].price) {
                console.log("Wait for price to decrease");
            } else if (currentPrice < alerts[i].price) {
                console.log("Its time to buy your product");
                sendNotification(alerts[i].url, alerts[i].fcm_token);
            }
        });
    }
})

function fetchPrice(productUrl, price) {
    console.log("Getting current price");
    axios.get(productUrl).then(({ data }) => {
        const $ = cheerio.load(data);

        let strPrice = "";
        if ($('.a-offscreen', '#apex_desktop').html()) {
            strPrice = $('.a-offscreen', '#apex_desktop').html();
        } else {
            strPrice = $('.a-offprice', '#apex_desktop').html();
        }

        const currentPrice = parseFloat(strPrice.split(',').join(""));

        console.log(currentPrice, price, strPrice, strPrice.split(',').join(""));

        if (currentPrice == price) {
            console.log("Equal Price");
            sendNotification(productUrl);
        } else if (currentPrice > price) {
            console.log("Wait for price to decrease");
        } else if (currentPrice < price) {
            console.log("Its time to buy your product");
            sendNotification(productUrl);
        }
    });
}

async function fetchDetails(productUrl) {
    console.log("Getting current price");
    const { data } = await axios.get(productUrl);
    const $ = cheerio.load(data);
    let strPrice = "";
    if ($('.a-offscreen', '#apex_desktop').html()) {
        strPrice = $('.a-offscreen', '#apex_desktop').html();
    } else {
        strPrice = $('.a-offprice', '#apex_desktop').html();
    }
    const productData = {
        'imgUrl': $('#landingImage').attr('src'),
        'price': strPrice,
        'title': $('#productTitle').html().trim(),
    };
    console.log(productData);
    return productData;
}


function sendNotification(productUrl, token) {
    // const receivedToken = req.body.fcmToken;

    // console.log(receivedToken);

    const message = {
        notification: {
            title: "Price alert",
            body: "It's time to order"
        },
        data: {
            test: productUrl
        },
        token: token,
    };

    getMessaging()
        .send(message)
        .then((response) => {
            console.log("Successfully sent message:", response);
        })
        .catch((error) => {
            console.log("Error sending message:", error);
        });
}


// Routes
app.get('/alerts', async (req, res) => {
    try {
        const alerts = await Alert.find();
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving tasks' });
    }
});

app.post('/details', async (req, res) => {

    const { url } = req.body;

    console.log(url);

    try {
        let result = {};
        if (url) {
            result = await fetchDetails(url);
            console.log(result);
        }

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error creating alert' });
    }
});

app.post('/alerts', async (req, res) => {
    const { email, url, price } = req.body;

    const user = await User.findOne({ email });

    if (!url || !price) {
        return res.status(400).json({ message: 'URL and Price are required' });
    }
    try {
        fetchPrice(url, price);
        const newAlert = await Alert.create({ url, price, user_id: user._id, fcm_token: user.fcm_token });
        res.status(201).json(newAlert);
    } catch (error) {
        res.status(500).json({ message: 'Error creating alert' });
    }
});


// Register route
app.post('/register', async (req, res) => {
    try {
        const { email, password, fcm_token } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log(email, hashedPassword, fcm_token);

        const checkUser = await User.findOne({ email });

        if (checkUser) {
            return res.status(401).json({ error: 'User already exists' });
        }

        const user = new User({
            email: email,
            password: hashedPassword,
            fcm_token: fcm_token
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error registering user' });
    }
});

// Login route
app.post('/login', async (req, res) => {
    try {
        const { email, password, fcm_token } = req.body;

        console.log(email, password, fcm_token);

        const user = await User.findOne({ email });

        console.log(user);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        console.log(isPasswordValid);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await User.findOneAndUpdate(
            {
                email: email
            },
            {
                fcm_token: fcm_token
            }
        );

        res.status(200).json({ id: user._id, message: 'Login successful' });
    } catch (err) {
        res.status(500).json({ error: 'Error logging in' });
    }
});

app.post("/send", function (req, res) {
    const receivedToken = req.body.fcmToken;

    console.log(receivedToken);

    const message = {
        notification: {
            title: "Notif",
            body: 'This is a Test Notification'
        },
        data: {
            test: "check"
        },
        token: "ftTEe1fVTP2_xzGtwRToH4:APA91bGpgViNM4oFCxVQShEt5gZ7H1E4vvipZBK818SVwv7RF1eb8q5HBjktYWNdAyRmSapsPTTaV6ZDmyNQxcfXPODk0E9x3IrOcUoFtVv26XQXrIYjjTS9DTzrh8ftFQyzfD7xLBMV",
    };

    getMessaging()
        .send(message)
        .then((response) => {
            res.status(200).json({
                message: "Successfully sent message",
                token: receivedToken,
            });
            console.log("Successfully sent message:", response);
        })
        .catch((error) => {
            res.status(400);
            res.send(error);
            console.log("Error sending message:", error);
        });


});

app.listen(3000, function () {
    console.log("Server started on port 3000");
});