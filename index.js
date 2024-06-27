const express = require("express");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.t4loxgb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleware for verify token
const verifyToken = (req, res, next) => {
  console.log("inside-verify-token", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "forbidden access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const animalsCollection = client.db("Animals_Datas").collection("animals");
    const adoptionCollection = client
      .db("Animals_Datas")
      .collection("Adoption");
    const donationCollection = client
      .db("Animals_Datas")
      .collection("DonationCamp");
    const usersCollection = client.db("Animals_Datas").collection("users");
    const donatedCollection = client.db("Animals_Datas").collection("donation");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //user related api
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const query = { email: userInfo.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    // this api for admin check
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log("email", email);
      if (email !== req.decoded.email) {
        res.status(403).send({ message: "unauthorized access" });
      } else {
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let isAdmin = false;
        if (user) {
          isAdmin = user?.role === "admin";
        }
        res.send({ isAdmin });
      }
    });

    // this api for make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // this api for find all user
    app.get("/users", verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // this api for find all donation camp
    app.get("/DonationCamp", async (req, res) => {
      const result = await donationCollection.find().toArray();
      res.send(result);
    });

    // this api for get own animals
    app.get("/animals", async (req, res) => {
      const email = req.query.email;
      const query = { owner_email: email };
      const result = await animalsCollection.find(query).toArray();
      res.send(result);
    });

    // this api for get own donation
    app.get("/own-donation", async (req, res) => {
      const email = req.query.email;
      const query = { owner_email: email };
      const result = await donatedCollection.find(query).toArray();
      res.send(result);
    });
    // this api for get adoption request
    app.get("/adoption-request", async (req, res) => {
      const email = req.query.email;
      const query = { owner_email: email };
      const result = await adoptionCollection.find(query).toArray();
      res.send(result);
    });

    // this api for myDonation Campaign list
    app.get("/DonationCampOwn", async (req, res) => {
      const email = req.query.email;
      const query = { owner_email: email };
      const result = await donationCollection.find(query).toArray();
      res.send(result);
    });

    // this api for all animals
    app.get("/all-animals-admin", async (req, res) => {
      const result = await animalsCollection.find().toArray();
      res.send(result);
    });

    app.get("/all-animals", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      try {
        const result = await animalsCollection
          .find()
          .skip(skip)
          .limit(limit)
          .toArray();
        const total = await animalsCollection.countDocuments();
        const hasNextPage = page * limit < total;

        res.send({
          listings: result,
          nextPage: hasNextPage ? page + 1 : null,
          total,
        });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // this api for all donation camp
    app.get("/DonationCamp", verifyToken, async (req, res) => {
      const result = await donationCollection.find().toArray();
      res.send(result);
    });

    // this api for details data
    app.get("/animals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await animalsCollection.findOne(query);
      res.send(result);
    });
    // this api for details donation data
    app.get("/DonationCamp/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.findOne(query);
      res.send(result);
    });

    // this api for load specific id to data
    app.get("/DonationCamp/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.find(query).toArray();
      res.send(result);
    });

    // api for update Pet Animals
    app.put("/animals/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const petItem = req.body;
      const update = {
        $set: {
          category: petItem.category,
          petImage: petItem.petImage,
          petName: petItem.petName,
          petAge: petItem.petAge,
          petLocation: petItem.petLocation,
          owner_email: petItem.owner_email,
          owner_name: petItem.owner_name,
        },
      };
      const result = await animalsCollection.updateOne(filter, update, options);
      res.send(result);
    });

    // this api for update donation camp
    app.put("/DonationCamp/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const petItem = req.body;
      const update = {
        $set: {
          petImage: petItem.petImage,
          petName: petItem.petName,
          owner_email: petItem.owner_email,
          owner_name: petItem.owner_name,
          shortDescription: petItem.shortDescription,
          LastDate: petItem.LastDate,
          MaxAmount: petItem.MaxAmount,
          longDescription: petItem.longDescription,
        },
      };
      const result = await donationCollection.updateOne(
        filter,
        update,
        options
      );
      res.send(result);
    });

    // this api for delete method to pet
    app.delete("/animals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await animalsCollection.deleteOne(query);
      res.send(result);
    });

    // this api for delete donation camp
    app.delete("/DonationCamp/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.deleteOne(query);
      res.send(result);
    });

    // this api for post adoption data
    app.post("/adoption", async (req, res) => {
      const AdoptItem = req.body;
      console.log(AdoptItem);
      const result = await adoptionCollection.insertOne(AdoptItem);
      res.send(result);
    });
    // this api for post adoption data
    app.post("/donation", async (req, res) => {
      const donatedItem = req.body;
      console.log(donatedItem);
      const result = await donatedCollection.insertOne(donatedItem);
      res.send(result);
    });

    // this api for post animal Item or PET
    app.post("/animals", async (req, res) => {
      const petItem = req.body;
      console.log(petItem);
      const result = await animalsCollection.insertOne(petItem);
      res.send(result);
    });

    // this api for post donation campaign
    app.post("/DonationCamp", async (req, res) => {
      const petItem = req.body;
      console.log(petItem);
      const result = await donationCollection.insertOne(petItem);
      res.send(result);
    });

    // payment method stripe
    app.post("/payment-intent-stripe", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      console.log(amount, "inside the intents");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("animals is playing now");
});

app.listen(port, () => {
  console.log(`animals is playing now in the port : ${port}`);
});
