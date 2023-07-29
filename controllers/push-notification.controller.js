const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const schedule = require('node-schedule');
const cheerio = require('cheerio');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// MongoDB connection (Replace 'your-mongodb-connection-string' with your actual connection string)
mongoose.connect('mongodb+srv://baranidharanofficial:5U29QvB6eoghs7Da@training.liykfwa.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Task schema and model
const taskSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
});

const Task = mongoose.model('Task', taskSchema);



const fetchPrice = (productUrl) => {
    schedule.scheduleJob('*/5 * * * * *', () => {
        console.log("I ran...");
        axios.get(productUrl).then(({ data }) => {
            const $ = cheerio.load(data);
            let price = $('.a-price-whole', '#apex_desktop').html();
            console.log(price);
        })
    })
}

// Routes
app.get('/tasks', async (req, res) => {
    try {
        const tasks = await Task.find();
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving tasks' });
    }
});

app.post('/tasks', async (req, res) => {
    const { id, title, description } = req.body;
    if (!id || !title) {
        return res.status(400).json({ message: 'Task ID and title are required' });
    }

    fetchPrice(description);

    try {
        const newTask = await Task.create({ id, title, description });
        res.status(201).json(newTask);
    } catch (error) {
        res.status(500).json({ message: 'Error creating task' });
    }
});

app.put('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;

    try {
        const taskToUpdate = await Task.findOneAndUpdate(
            { id },
            { title, description },
            { new: true }
        );

        if (!taskToUpdate) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json(taskToUpdate);
    } catch (error) {
        res.status(500).json({ message: 'Error updating task' });
    }
});

app.delete('/tasks/:id', async (req, res) => {
    const { id } = req.params;

    try {
        await Task.findOneAndDelete({ id });
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting task' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});