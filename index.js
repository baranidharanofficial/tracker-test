import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getMessaging } from "firebase-admin/messaging";
import express, { json } from "express";
import cors from "cors";
import mongoose from 'mongoose';
import schedule from 'node-schedule';
import cheerio from 'cheerio';
import axios from 'axios';

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

const fetchPrice = (productUrl, price) => {
    schedule.scheduleJob('*/30 * * * * *', () => {
        console.log("Getting current price");
        axios.get(productUrl).then(({ data }) => {
            const $ = cheerio.load(data);
            let strPrice = $('.a-price-whole', '#apex_desktop').html();
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
        })
    })
}


function sendNotification(productUrl) {
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
        token: "ftTEe1fVTP2_xzGtwRToH4:ftTEe1fVTP2_xzGtwRToH4:APA91bGpgViNM4oFCxVQShEt5gZ7H1E4vvipZBK818SVwv7RF1eb8q5HBjktYWNdAyRmSapsPTTaV6ZDmyNQxcfXPODk0E9x3IrOcUoFtVv26XQXrIYjjTS9DTzrh8ftFQyzfD7xLBMV",
    };

    getMessaging()
        .send(message)
        .then((response) => {
            // res.status(200).json({
            //     message: "Successfully sent message",
            //     token: "ftTEe1fVTP2_xzGtwRToH4:ftTEe1fVTP2_xzGtwRToH4:APA91bGpgViNM4oFCxVQShEt5gZ7H1E4vvipZBK818SVwv7RF1eb8q5HBjktYWNdAyRmSapsPTTaV6ZDmyNQxcfXPODk0E9x3IrOcUoFtVv26XQXrIYjjTS9DTzrh8ftFQyzfD7xLBMV",
            // });
            console.log("Successfully sent message:", response);
        })
        .catch((error) => {
            // res.status(400);
            // res.send(error);
            console.log("Error sending message:", error);
        });
}

// Task schema and model
const alertSchema = new mongoose.Schema({
    url: { type: String, required: true },
    price: { type: String, required: true },
});

const Alert = mongoose.model('Alert', alertSchema);

// Routes
app.get('/alerts', async (req, res) => {
    try {
        const alerts = await Alert.find();
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving tasks' });
    }
});

app.post('/alerts', async (req, res) => {
    const { url, price } = req.body;
    if (!url || !price) {
        return res.status(400).json({ message: 'URL and Price are required' });
    }
    try {
        fetchPrice(url, price);
        const newAlert = await Alert.create({ url, price });
        res.status(201).json(newAlert);
    } catch (error) {
        res.status(500).json({ message: 'Error creating task' });
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
            // res.status(200).json({
            //     message: "Successfully sent message",
            //     token: receivedToken,
            // });
            console.log("Successfully sent message:", response);
        })
        .catch((error) => {
            // res.status(400);
            // res.send(error);
            console.log("Error sending message:", error);
        });


});

app.listen(3000, function () {
    console.log("Server started on port 3000");
});