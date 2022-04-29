 
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

// VALIDATION

const nameSchema = joi.object({
    name: joi.string()
        .required()
})

// API 

app.post('/participants', async (req, res) => {
    const validation = nameSchema.validate({ name: req.body.name });
    if(validation.error){
        res.status(422).send("Insira um nome válido");
        return;
    }
    const participant = {
        name: req.body.name, 
        lastStatus: Date.now()
    }
    const online = {
        from: req.body.name, 
        to: 'Todos', 
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format("HH:mm:ss")
    }
    try {
        await mongoClient.connect();
        database = mongoClient.db('bate-papo-uol');
        const contains = await database.collection("participants").findOne({name: req.body.name});
        if(contains){
            res.status(409).send("Já existe um usuário com esse nome. Insira outro");
            return;
        }
        await database.collection("participants").insertOne(participant);
        await database.collection("participantsOnline").insertOne(online);
        res.status(201).send('ok');
        mongoClient.close();
        ;
    }catch (err) {
        res.status(500).send('Erro');
    }
})


app.listen(5000)
