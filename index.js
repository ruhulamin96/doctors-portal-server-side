const express = require("express");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const admin = require("firebase-admin");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
const { response } = require("express");

//middleware
app.use(cors());
app.use(express.json());
//doctors-portal-4493a-firebase-adminsdk.json

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4ovqx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.body.headers?.Authorization.startsWith("Bearer ")) {
    const token = req.body.headers.Authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch (error) {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("doctors_portal");
    const appointmentCollection = database.collection("appointments");
    const usersCollection = database.collection("users");
    console.log("connect successfull");
    //query code
    app.get("/appointments", async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();
      const query = { email: email, date: date };
      const cursor = appointmentCollection.find(query);
      const result = await cursor.toArray();

      res.json(result);
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const users = await usersCollection.findOne(query);
      let isAdmin = false;
      // console.log(users.role==='admin')
      if (users?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
    app.post("/appointments",verifyToken, async (req, res) => {
      const data = req.body;
      const result = await appointmentCollection.insertOne(data);
      res.json(result);
      console.log(data);
    });
    app.post("/users", async (req, res) => {
      const data = req.body;
      const result = await usersCollection.insertOne(data);
      res.json(result);
    });
    app.put("/users", async (req, res) => {
      const data = req.body;

      const filter = { email: data.email };
      const options = { upsert: true };
      const doc = {
        $set: {
          email: data.email,
          displayName: data.displayName,
        },
      };

      const result = await usersCollection.updateOne(filter, doc, options);
      res.json(result);
    });
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = usersCollection.findOne({ email: requester });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };

          const updateDoc = {
            $set: { role: "admin" },
          };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      }else{
        res.status(401).json({message:'you do not have access made admin'})
      }
    });
  } finally {
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server listening at Port ${port}`);
});
