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

const Alert = mongoose.model('Alert', alertSchema);

const User = mongoose.model('User', userSchema);


schedule.scheduleJob('* * * * *', async () => {
    console.log("Getting current price");

    const alerts = await Alert.find();

    for (let i = 0; i < alerts.length; i++) {
        // console.log(alerts[i]);
        axios.get(alerts[i].url).then(({ data }) => {
            const $ = cheerio.load(data);
            let strPrice = "0";
            if ($('.a-offscreen', '#apex_desktop').html()) {
                strPrice = $('.a-offscreen', '#apex_desktop').html();
            } else if ($('.a-offprice', '#apex_desktop').html()) {
                strPrice = $('.a-offprice', '#apex_desktop').html();
            }

            console.log(strPrice);
            const currentPrice = parseFloat(strPrice.split(',').join("").slice(1));

            console.log(currentPrice, alerts[i].alert_price, strPrice, strPrice.split(',').join(""));

            if (currentPrice == alerts[i].alert_price) {
                console.log("Equal Price");
                sendNotification(alerts[i]);
            } else if (currentPrice > alerts[i].alert_price) {
                console.log("Wait for price to decrease");
            } else if (currentPrice < alerts[i].alert_price) {
                console.log("Its time to buy your product");
                sendNotification(alerts[i]);
            }
        }).catch((err) => {
            console.log("Error " + err);

        });
    }
})

async function fetchDetails(productUrl) {
    console.log("Getting current price");
    const { data } = await axios.get(productUrl);
    const $ = cheerio.load(data);
    let strPrice = "";
    if ($('.a-offscreen', '#apex_desktop').html()) {
        strPrice = $('.a-offscreen', '#apex_desktop').html();
    } else if ($('.a-offprice', '#apex_desktop').html()) {
        strPrice = $('.a-offprice', '#apex_desktop').html();
    }
    const productData = {
        'imgUrl': $('#landingImage').attr('src'),
        'price': strPrice,
        'title': $('#productTitle').html().trim(),
    };
    console.log(productData, "test");
    return productData;
}


function sendNotification(alert) {
    // const receivedToken = req.body.fcmToken;

    // console.log(receivedToken);

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


// Routes
app.get('/alerts', async (req, res) => {
    try {
        const alerts = await Alert.find();
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving tasks' });
    }
});

// Routes
app.get('/alerts/:user_id', async (req, res) => {
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