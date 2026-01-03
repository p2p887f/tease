const express=require("express");
const http=require("http");
const cors=require("cors");

const app=express();
app.use(cors());
app.use(express.json());

const server=http.createServer(app);

const io=require("socket.io")(server,{
cors:{origin:"*"}
});

io.on("connection",sock=>{
sock.on("join",uid=>sock.join(uid));
});

app.post("/push",(req,res)=>{
io.to(req.body.uid).emit("update",req.body);
res.json({ok:true});
});

server.listen(3000);
