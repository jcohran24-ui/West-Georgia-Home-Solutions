const express = require("express");
const path = require("path");
const app = express();

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req,res)=>res.json({ok:true}));

// Production TODO:
// 1) Replace browser localStorage with Supabase/Postgres.
// 2) POST /api/leads -> validate -> save -> route by service + ZIP.
// 3) Send SMS/email through Twilio/Resend.
// 4) Add Stripe subscriptions or lead credits.
// 5) Add authenticated admin dashboard.
// 6) Add spam/rate limiting and server-side consent logging.

app.listen(process.env.PORT || 3000, ()=>{
  console.log(`West Georgia Home Solutions running on port ${process.env.PORT || 3000}`);
});
