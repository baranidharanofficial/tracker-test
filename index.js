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
    projectId: 'rate-flicks',
});

// Task schema and model
const alertSchema = new mongoose.Schema({
    url: { type: String, required: true },
    imgUrl: { type: String, required: true },
    title: { type: String, required: true },
    alert_price: { type: String, required: true },
    current_price: { type: String, required: true },
    user_id: { type: String, required: false },
    fcm_token: { type: String, required: false },
});

// Task schema and model
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fcm_token: { type: String, required: false },
});

const dealSchema = new mongoose.Schema({
    url: { type: String, required: true, },
    img_url: { type: String, required: true },
});

const offerSchema = new mongoose.Schema({
    url: { type: String, required: true, },
    img_url: { type: String, required: true },
    offer_price: { type: String, required: true },
    price: { type: String, required: true },
    title: { type: String, required: true },
});

const Alert = mongoose.model('Alert', alertSchema);

const User = mongoose.model('User', userSchema);

const TopDeal = mongoose.model('Deal', dealSchema);

const Offer = mongoose.model('Offer', offerSchema);


schedule.scheduleJob('* * * * *', async () => {
    console.log("---- PRICE DROP ALERT -----");

    const alerts = await Alert.find();

    for (let i = 0; i < alerts.length; i++) {
        console.log(alerts[i].title);
        try {
            const { data } = await axios.get(alerts[i].url);
            const $ = cheerio.load(data);
            let strPrice = "0";
            if ($('.a-offscreen', '#apex_desktop').html()?.trim().length > 0) {
                strPrice = $('.a-offscreen', '#apex_desktop').html();
            } else if ($('.a-offprice', '#apex_desktop').html()?.trim().length > 0) {
                strPrice = $('.a-offprice', '#apex_desktop').html();
            } else if ($('.a-price-whole', '#apex_desktop').html()?.trim().length > 0) {
                strPrice = $('.a-price-whole', '#apex_desktop').html();
            }

            console.log(strPrice);
            let currentPrice = parseFloat(strPrice.split(',').join(""));

            if (strPrice.split(',').join("").includes('₹')) {
                currentPrice = parseFloat(strPrice.split(',').join("").slice(1));
            }

            console.log(currentPrice, alerts[i].alert_price, strPrice, strPrice.split(',').join(""));

            await Alert.findOneAndUpdate(
                { _id: alerts[i]._id },
                { current_price: currentPrice }
            );

            if (currentPrice == alerts[i].alert_price) {
                console.log("Equal Price");
                sendNotification(alerts[i]);
            } else if (currentPrice > alerts[i].alert_price) {
                console.log("Wait for price to decrease");
            } else if (currentPrice < alerts[i].alert_price) {
                console.log("Its time to buy your product");
                sendNotification(alerts[i]);
            }
        } catch (err) {
            console.log("Error " + err);
        };
    }
})

async function fetchDetails(productUrl) {
    console.log("---- FETCHING DETAILS -----");

    try {
        const { data } = await axios.get(productUrl);
        const $ = cheerio.load(data);
        let strPrice = "0";
        if ($('.a-offscreen', '#apex_desktop').html()?.trim().length > 0) {
            strPrice = $('.a-offscreen', '#apex_desktop').html();
        } else if ($('.a-offprice', '#apex_desktop').html()?.trim().length > 0) {
            strPrice = $('.a-offprice', '#apex_desktop').html();
        } else if ($('.a-price-whole', '#apex_desktop').html()?.trim().length > 0) {
            strPrice = $('.a-price-whole', '#apex_desktop').html();
        }

        const productData = {
            'imgUrl': $('#landingImage').attr('src'),
            'price': strPrice,
            'title': $('#productTitle').html().trim(),
        };
        console.log(productData, "test");
        return productData;
    } catch (err) {
        console.log("Error : " + err);
    }

}


function sendNotification(alert) {
    // const receivedToken = req.body.fcmToken;

    // console.log(receivedToken);

    console.log({
        url: alert['url'],
        title: alert['title'],
        imgUrl: alert['imgUrl'],
        alert_price: alert['alert_price'],
    });

    const message = {
        notification: {
            title: "Price drop alert !!!",
            body: "For " + alert['title']
        },
        data: {
            url: alert['url'],
            title: alert['title'],
            imgUrl: alert['imgUrl'],
            alert_price: alert['alert_price'],
        },
        token: alert['fcm_token'],
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


// ADD TOP DEALS
app.post('/top-deals', async (req, res) => {
    console.log("---- ADD TOP DEALS -----");
    try {
        const items = req.body;

        const result = await TopDeal.insertMany(items);

        res.json({
            success: true,
            insertedCount: result.length,
            insertedIds: result.map(item => item._id),
        });
    } catch (error) {
        console.error('Error adding items to MongoDB', error);
        res.status(500).json({ error: 'Failed to add items to MongoDB' });
    }
});

// GET TOP DEALS
app.get('/top-deals', async (req, res) => {
    console.log("---- FETCH TOP DEALS -----");
    try {
        const deals = await TopDeal.find();
        res.status(200).json(deals);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving tasks' });
    }
});

// DEALS
app.post('/offers', async (req, res) => {
    console.log("---- ADD OFFERS -----");
    try {
        const items = req.body;

        const result = await Offer.insertMany(items);

        res.json({
            success: true,
            insertedCount: result.length,
            insertedIds: result.map(item => item._id),
        });
    } catch (error) {
        console.error('Error adding items to MongoDB', error);
        res.status(500).json({ error: 'Failed to add items to MongoDB' });
    }
});

// Routes
app.get('/offers', async (req, res) => {
    console.log("---- FETCH OFFERS -----");
    try {
        const deals = await Offer.find();
        res.status(200).json(deals);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving tasks' });
    }
});

// Routes
app.get('/alerts', async (req, res) => {
    console.log("---- FETCH ALERTS -----");
    try {
        const alerts = await Alert.find();
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving tasks' });
    }
});

// Routes
app.get('/alerts/:user_id', async (req, res) => {
    console.log("---- FETCH ALERTS BY USER -----");
    try {
        const userId = req.params.user_id;

        Alert.find({ user_id: userId })
            .then((alerts) => {
                // `users` contains an array of documents matching the filter
                console.log(alerts);
                res.status(200).json(alerts);
            })
            .catch((error) => {
                console.error('Error fetching users:', error);
                res.status(500).json({ message: 'Error retrieving tasks' });
            });


    } catch (error) {
        res.status(500).json({ message: 'Error retrieving tasks' });
    }
});

app.delete('/alerts/:id', async (req, res) => {
    try {
        const alertId = req.params.id;

        await Alert.findOneAndDelete({ _id: alertId });

        res.status(200).json({ message: "Alert Deleted Successfully" });

    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
})

app.post('/details', async (req, res) => {
    console.log("---- FETCH PRODUCT DETAILS -----");
    const { url } = req.body;

    console.log(url)

    try {
        if (url) {
            let result = await fetchDetails(url);
            console.log(result);
            res.status(200).json(result);
        } else {
            console.log(url);
        }
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/alerts', async (req, res) => {
    console.log("---- CREATE ALERT -----");
    const { email, url, price } = req.body;

    const user = await User.findOne({ email });

    if (!url || !price) {
        return res.status(400).json({ message: 'URL and Price are required' });
    }

    try {
        const details = await fetchDetails(url);
        console.log(details);
        const newAlert = await Alert.create({
            url: url,
            imgUrl: details.imgUrl,
            alert_price: price,
            current_price: details.price,
            title: details.title,
            user_id: user._id,
            fcm_token: user.fcm_token,
        });
        res.status(201).json(newAlert);
    } catch (error) {
        res.status(500).json({ message: 'Error creating alert' });
    }
});






// Register route
app.post('/register', async (req, res) => {
    console.log("---- REGISTER -----");
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
        res.status(201).json({ id: user._id, message: 'User registered successfully', });
    } catch (err) {
        res.status(500).json({ error: 'Error registering user' });
    }
});

// Login route
app.post('/login', async (req, res) => {
    console.log("---- LOGIN -----");
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

        Alert.updateMany({ user_id: user._id }, { fcm_token: fcm_token })
            .then((result) => {
                console.log(`${result.nModified} FCM tokens updated`);
            })
            .catch((error) => {
                console.error('Error updating FCM tokens:', error);
            });

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