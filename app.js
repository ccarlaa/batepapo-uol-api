 
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import { application } from "express";
import dayjs from "dayjs";

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient("mongodb://127.0.0.1:27017");
let database = null;

const nameSchema = joi.object({
    name: joi.string()
        .required()
})

const messageSchema = joi.object({
    to: joi.string()
        .required(),
    text: joi.string()
        .required(),
    type: joi.string()
        .valid("message", "private_message")
        .required()
})

// API 

app.post('/participants', async (req, res) => {
    const {name} = req.body;
    const validation = nameSchema.validate({ name: name});
    if(validation.error){
        res.status(422).send("Insira um nome válido");
        mongoClient.close();
        return;
    }
    const participant = {
        name: name, 
        lastStatus: Date.now()
    }
    const online = {
        from: name, 
        to: 'Todos', 
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format("HH:mm:ss")
    }
    try {
        await mongoClient.connect();
        database = mongoClient.db('bate-papo-uol');
        const contains = await database.collection("participants").findOne({name: name});
        if(contains){
            res.status(409).send("Já existe um usuário com esse nome. Insira outro");
            mongoClient.close();
            return;
        }
        await database.collection("participants").insertOne(participant);
        await database.collection("participantsOnline").insertOne(online);
        res.status(201).send('ok');
    }catch (err) {
        res.status(500).send('Erro');
    }
    mongoClient.close();
})

app.get('/participants', async (req, res) => {
    try {
        await mongoClient.connect();
        database = mongoClient.db('bate-papo-uol');
        const participants = await database.collection("participants").find().toArray(); 
        res.status(200).send(participants);
    } catch (err) {
        res.status(500).send('Erro');
    }
    mongoClient.close();
})

app.post('/messages', async (req, res) => {
    const {to , text, type} = req.body;
    const user = req.headers.user;
    const validation = messageSchema.validate({to, text, type});
    if(validation.error){
        res.status(422).send("Insira um nome válido");
        mongoClient.close();
        return;
    }
    try {
        await mongoClient.connect();
        database = mongoClient.db('bate-papo-uol');
        const message = {
            to,
            text,
            type,
            from: user,
            time: dayjs().format("HH:mm:ss")
        }
        const isOnline = await database.collection("participants").findOne({name: user});
        if(!isOnline){
            res.status(422).send("Você não está mais online");
            mongoClient.close();
            return;
        }
        await database.collection("messages").insertOne(message);
        res.status(201).send('ok');
    } catch (err) {
        res.status(500).send('Erro');
    }
    mongoClient.close();
})

app.get('/messages', async (req, res) => {
    const limit = req.query.limit;
    const user = req.headers.user;
    try {
        await mongoClient.connect();
        database = mongoClient.db('bate-papo-uol');
        const messages = await database.collection("messages").find().toArray();
        const filteredMessages = messages.filter(message => message.from === user || message.to === user || message.to === "Todos" || message.type === 'message');
        if(limit === undefined){
            res.status(200).send(filteredMessages);
        } else {
            const start = filteredMessages.length - limit;
            const end = filteredMessages.length
            const slicedMessages = filteredMessages.slice(start, end);
            res.status(200).send(slicedMessages);
        }
    } catch (err) {
        res.status(500).send('Erro');
    }
    mongoClient.close();
})

app.post('/status', async (req, res) => {
    const user = req.headers.user;
    try{
        await mongoClient.connect();
        database = mongoClient.db('bate-papo-uol');
        const isOnline = await database.collection("participants").findOne({name: user});
        if(!isOnline){
            res.status(404).send('O usuário não está online');
        } else {
            await database.collection("participants").updateOne({ _id: isOnline._id }, { $set: { lastStatus: Date.now() } });
            res.status(200).send('ok');
        }
    } catch(err){
        res.status(500).send('Erro');
    }
    mongoClient.close();
})

setInterval(async () => {
    try {
        await mongoClient.connect();
        database = mongoClient.db('bate-papo-uol');
        const participants = await database.collection("participants").find().toArray();
        for (const participant of participants) {
            if (Date.now() - participant.lastStatus > 10000) {
                    await database.collection("participants").deleteOne({ _id: participant._id });
                    await database.collection("messages").insertOne({
                    from: participant.name, 
                    to: "Todos", 
                    text: "sai da sala...",
                    type: "status", 
                    time: dayjs().format("HH:mm:ss") 
                })
            }
        }
    } catch (error) {
        console.log("Erro")
    }
}, 15000);

app.listen(5000);
