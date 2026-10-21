const prisma=require("../../src/config/prisma");
async function fixture() {
  const users=[],mandals=[];
  const city="HomeLoad"+Date.now();
  try {
    for(let i=0;i<8;i++) users.push(await prisma.user.create({ data:{ mobile:String(7000000000+Math.floor(Math.random()*999999999)),name:"Load fixture "+i,city:city+(i%2),state:"FixtureState",isVerified:true } }));
    for(let i=0;i<4;i++) {
      const m=await prisma.mandal.create({ data:{ name:"Load fixture Mandal "+i,category:"Cultural",status:"ACTIVE",createdById:users[0].id,
        address:{ create:{ addressLine1:"Fixture address",city:city+(i%2),state:"FixtureState",pincode:"411001" } } } });
      mandals.push(m.id);
      await prisma.homePost.createMany({ data:Array.from({length:30},(_,n)=>({ mandalId:m.id,authorId:users[0].id,
        text:"Community update ".repeat(35),city:city+(i%2),state:"FixtureState",publishedAt:new Date(Date.now()-n*60000) })) });
      await prisma.homeEvent.create({ data:{ mandalId:m.id,title:"Festival fixture",description:"Test festival",venue:"Test venue",category:"Cultural",
        city:city+(i%2),state:"FixtureState",startsAt:new Date(Date.now()+86400000),endsAt:new Date(Date.now()+172800000),
        promotionStart:new Date(Date.now()-1000),promotionEnd:new Date(Date.now()+86400000) } });
    }
    return { users,mandals,cleanup:async()=>{
      await prisma.mandal.deleteMany({where:{id:{in:mandals}}});
      await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
    } };
  } catch(error) {
    await prisma.mandal.deleteMany({where:{id:{in:mandals}}});
    await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
    throw error;
  }
}
module.exports={fixture};
