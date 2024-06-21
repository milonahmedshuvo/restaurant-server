const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_PAYMENT_SECRET);
const port = process.env.PORT | 5000


// middleware 
app.use(cors())
app.use(express.json())





const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.hcgdznz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const userCollection = client.db("bistroDB").collection("users")
    const menuCollection = client.db("bistroDB").collection("menu")
    const reviewCollection = client.db("bistroDB").collection("reviews")
    const cartCollection = client.db("bistroDB").collection("carts")
    const paymentCollection = client.db("bistroDB").collection("payments")







    

  // JWT token api.......
  app.post("/users/jwt", async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.JESON_WEB_TOKEN, {expiresIn: "1h"})
      res.send(token)
  }) 


  // middleware use.......defferent route thke token asbe headers dia 
  const verifyToken = async ( req, res, next) => {
    // const tok = req.headers.authorization 
    // console.log( "client", tok)

         if( !req.headers.authorization ){
         return res.status(401).send({message: "token not find"})
         }


        const token =  req.headers.authorization.split(" ")[1]


        jwt.verify(token, process.env.JESON_WEB_TOKEN, (err, decoded) =>{

          if(err){
            return res.status(401).send({message: "unauthorization access jwt"})
          }

          req.decoded = decoded
        })


      
    next()
  }







  // admin verify by user role / middleware
  const adminVerify = async (req, res, next ) => {
    const email = req.decoded.email
    const query = { email : email }
    const user = await userCollection.findOne(query)
    const isAdmin = user?.role === "admin"
    // console.log("isadmin", isAdmin, query)

    if(!isAdmin){
      return res.status(403).send({message: "forbidden access"})
    }
    next()

  }





    

    app.post("/users", async (req, res) => {
        const user = req.body
        const query = { email: user.email}
        const existingUser = await userCollection.findOne(query)
        if(existingUser){
         return res.send({ message: "already email use", insertedId: null })
        }

        const result = await userCollection.insertOne(user)
        res.send(result)
    })


    app.get("/users", verifyToken, adminVerify, async (req, res) => {
        const allUsers = await userCollection.find().toArray()
        res.send(allUsers)
    })


    
    app.delete("/users/:id", verifyToken, adminVerify, async (req, res) => {
        const id = req.params.id 
        const query = { _id : new ObjectId(id)}
        const result = await userCollection.deleteOne(query)
        res.send(result)
    })


  //  user make admin by patch and update 
  app.patch("/user/admin/:id", verifyToken, adminVerify, async (req, res) => {
      const id = req.params.id 
      const filter = { _id : new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: "admin"
        }
      }

      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result)
  })
    

  // check admin 
  app.get("/users/admin/:email", verifyToken, async (req, res) => {
    const email = req.params.email
   

    if(email !== req.decoded.email) {
      return res.status(403).send({message: "unauthorized access"})
    } 

    const query = {email: email}
    const user = await userCollection.findOne(query)

    let admin = false
    if(user){
      admin = user.role === "admin"
    }

    res.send( { admin } )
  })









    
    app.get("/menus", async (req, res) =>{
        const menus = await menuCollection.find().toArray()
        res.send(menus)
    })

    app.get("/menu/:id", async (req, res) => {
        const id = req.params.id 
        const query = {_id:  id }
        console.log(query)
        const result = await menuCollection.findOne(query)
        res.send(result)
    })

    app.post("/menus", async (req, res) => {
        const body = req.body
        const result = await menuCollection.insertOne(body)
        res.send(result)
    })

    app.delete("/menu/:id", async ( req, res) => {
        const id = req.params.id 
        const query = { _id: id }
        console.log(query)
        const result = await menuCollection.deleteOne(query)
        res.send(result)
    })

    app.patch('/menu/:id', async (req, res) => {
      const id = req.params.id 
      const query = {_id: id}
      const item = req.body 
      const updateDoc = {
        $set: {
          name: item.name,
          recipe: item.recipe,
          category: item.category,
          price: item.price,
          image: item.image
        }
      }

      const result = await menuCollection.updateOne(query, updateDoc)
      res.send(result)
    })











    




    app.get("/reviews", async (req, res) =>{
      const reviews = await reviewCollection.find().toArray()
      res.send(reviews)
  })


    app.post("/carts", async (req, res ) => {
      const cartItem = req.body 
      const result =  await cartCollection.insertOne(cartItem)
      res.send(result)
    })

    app.get("/carts", async (req, res) => {
        const email = req.query.email 
        const query = { email: email}

        
        const carts = await cartCollection.find().toArray()
        res.send(carts)
    })

  
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id
      const query = {_id : new ObjectId(id) }
      // const query = {_id: id}
      console.log(query)

      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })


    






    // /create-payment-intent return client secret 
    
  app.post("/create-payment-intent", async (req, res) => {
      const {price} = req.body 
      const amount = parseInt(price * 100)
      console.log(amount, "payment intent inside amount")

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      })


      res.send({
        clientSecret: paymentIntent.client_secret,
      })

  })










  // post payment info data in database 

  app.post("/payments", async (req, res) => {
      const payment = req.body 
      console.log(payment)
      const paymentResult = await paymentCollection.insertOne(payment)



      // cart multipule data delete 
      const query = {_id: {
        $in: payment.cardIds.map(id => new ObjectId(id))
      }}

      const delateResult = await cartCollection.deleteMany(query)
      
      res.send({paymentResult, delateResult})
  })



  //  get payment info 
  app.get("/payments/:email", verifyToken, async (req, res) => {
     const query = {email: req.params.email}
     const paymentResult = await paymentCollection.find(query).toArray()
     res.send(paymentResult)
  })








//  show admin home data users, product, revene, order and payment 

app.get("/admin-state", async (req, res) => {
    const users = await userCollection.estimatedDocumentCount()
    const menus = await menuCollection.estimatedDocumentCount()
    const orders = await paymentCollection.estimatedDocumentCount()

    const payments = await paymentCollection.find().toArray()
    const revene = payments.reduce((total, item ) => total + item.price, 0)




    res.send({users, menus, orders, revene })
})





    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);















app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
