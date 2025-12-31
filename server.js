const express=require("express");
const http=require("http");
const cors=require("cors");
const axios=require("axios");

const SECRET="UltraSecureKey";

const app=express();
app.use(cors());
app.use(express.json());

const server=http.createServer(app);
const io=require("socket.io")(server,{cors:{origin:"*"}});

io.on("connection",sock=>{
 sock.on("joinRecharge",uid=>sock.join(uid));
});

app.post("/recharge-notify",(req,res)=>{
 io.to(req.body.uid).emit("rechargeUpdate",{status:"pending"});
 res.json({ok:true});
});

app.post("/admin/approve",async(req,res)=>{
 await axios.post("https://YOUR-LARAVEL/webhook/recharge/approve",
 {uid:req.body.uid,secret:SECRET,remark:req.body.remark||'Recharge Successful'});
 io.to(req.body.uid).emit("rechargeUpdate",{status:"success",remark:req.body.remark});
 res.json({ok:true});
});

app.post("/admin/reject",async(req,res)=>{
 await axios.post("https://YOUR-LARAVEL/webhook/recharge/reject",
 {uid:req.body.uid,secret:SECRET,remark:req.body.remark});
 io.to(req.body.uid).emit("rechargeUpdate",{status:"failed",remark:req.body.remark});
 res.json({ok:true});
});

server.listen(3000,()=>console.log("Realtime Recharge Running"));
