const cron = require("node-cron");
const userSchema = require("../../model/userSchema");
const taskSchema = require("../../model/taskSchema");
const statusMail = require("../../helper/mailFunction").statusMail
const startDate = require("../../helper/time").startDate
const endDate = require("../../helper/time").endDate;
const _ = require("lodash");
const { map } = require("lodash");


// Task create function with userid
exports.taskCreate = async (req, res) => {

  const id = req.params.userid;

  await taskSchema.create({
    task: req.body.task,
    taskDescription: req.body.taskDescription,
    taskSendBy: await userSchema.findOne({ _id: id }, { new: true }),
  })
    .then(async result => {

      res.status(201).json({ message: "Task created sucessfully",TaskDetails:result });
      await userSchema.findOneAndUpdate({_id:id},{$push: { taskDetails: result._id }})
      console.log("Task created");
    })

    .catch((err) => {
      res.status(500).json({error:err.message})
    });
};

// Task edit function
exports.taskEdit = async (req, res) => {

  await taskSchema.findByIdAndUpdate({ _id: req.params.taskid }, { $set: req.body })

    .then((task) => {
      if (task) {

        console.log(" Task edited successfully");
        res.status(200).json({ message: "Task Edited", task });

      } else {

        res.status(404).json({ message: "invalid id" });
      }
    })
    .catch((error) => {
      console.log(error.message);
      res.status(500).json({ error: error.message});
    });
};

//  Task Delete function
exports.taskDelete = async (req, res) => {

  await taskSchema.findByIdAndDelete({ _id: req.params.taskid }, { new: true })
    .then((task) => {

      if (!task) {

        res.status(400).json({message:"invalid taskID"});

      } else {

        console.log("user deleted successfully");
        res.status(200).json({message:"Task deleted successfully."});
      }
    })
    .catch((error) => {
      res.status(500).json({error:error.message});
    });
};

// if the user finish the task change the status Completed
exports.taskCompleted = async (req, res) => {

  const taskId = req.params.taskid ;

  await taskSchema.findByIdAndUpdate( { _id: taskId },{ $set: { status: "Completed" } },{ new: true })

    .then((result) => {
      if (result) {
        console.log(" Task Completed successfully");
        res.status(200).json({ message: "Task Completed", result});
      } else {
        res.status(404).json({error:"invalid taskID"});
      }
    })
    .catch((error) => {
      console.log(error.message);
      res.status(500).json({error:err.message});
    });
};

//find the user by task id 
exports.findUser = async (req, res) => {

  await taskSchema.findOne({ _id: req.body.taskid }).populate('taskSendBy',['task','status','userName','fullName','email'])

    .then((result) => {
    
      res.status(200).json({ message: "user details here",
      UserDetails: result

      });
      console.log(result);
    })
    .catch((err) => {
      res.status(500).json({error:err.message});
      console.log(err.message);
    });
};


/** View the Date wise Task  -if we give the Date in body(yyyy-mm-dd),
 * 
We get that day task list,else we get  Today's Task list  **/

exports.todayTask = async (req, res) => {

  const getDate = req.body.date;

  if (getDate) {
    const dateStart = getDate + "T00:00:00.000Z";
    const dateEnd = getDate + "T23:59:59.000Z";

    await taskSchema.find({ createdAt: { $gte: dateStart, $lt: dateEnd}})
    .then(task => {
      res.status(200).json({
        message:"task details here",
        taskDetails:task 
      })
      console.log(task);
     })
     .catch(err=>{
      res.status(500).json({error:err.message});
     })
  
  } else {

     await taskSchema.find({ createdAt: { $gte: startDate, $lt: endDate }})
    .then(todayTask=>{

      res.status(200).json({
        message:"task details here",
        TodayTaskDetails:todayTask 
      })
    })
     .catch(err=>{
      res.status(500).json({error:err.message});
     })
    
  }
};

// comment the task by userid and taskid
exports.taskComment = async (req, res) => {

 
  const userId = req.params.userid; 
  const taskId = req.params.taskid;

  await taskSchema.findById({ _id:taskId })

    .then(async result => {
    
      if (result.taskSendBy == userId && result._id == taskId)  {

       await Task.findOneAndUpdate( { _id: taskId },{ $set: { comment: req.body.comment } },{new:true})
        .then(comment => {

          res.status(200).json({
          message: "comment updated sucessfully",
          Comments:comment,
         });
        })
       }
        else {
        res.status(400).json({ message: "wrong userid or taskid"})

       } 
    })

    .catch((err) => {
      res.status(500).json({error:err.message});
    })
};


/* Mail Notification send on particular time*/

exports.mailSend = async (req, res) => {
  
  await taskSchema.find({createdAt: { $gte: startDate, $lt: endDate }}).populate("taskSendBy")

     .then((result) => {
    

       if(result.length == 0){ 

          res.status(200).json({message:"Tasks not updated Today"})
          console.log("Tasks not updated today")
        }

        else {

        cron.schedule("*/10 * * * * *", () => {     // E-mail schedule  at 9.00 pm
          
        for (const e in result) {
          
          const userEmail = result[e].tasksendBy.email;
          const fullName = result[e].tasksendBy.fullName;
          const task = result[e].task;
          const taskStatus = result[e].status;
  
          statusMail(userEmail,fullName,task,taskStatus)
          
          console.log(userEmail)
           
        }
            res.status(200).json({message:"EOD Mail sent to All"})
        });
      
        }

      })
      .catch (error => {
         console.log(error.message);
         res.status(500).json({error:error.message})
       })

};
exports.user = async (req, res) => {
 
  // await taskSchema.aggregate( [
  //    { $lookup: {
  //         from: "userdetails",
  //         localField: "taskSendBy",    
  //         foreignField: "_id",  
  //         as: "taskList"
  //      }
  //   },
  //   {$unwind : "$taskList"},
  // ] )
  await userSchema.aggregate( [
     { $lookup: {
          from: "tasks",
          localField: "taskDetails",    
          foreignField: "_id",  
          as: "taskList"
       }
    },
    {$unwind : "$taskList"},
  ] )
    

     .then(result => {

       console.log(result[0].taskList)
         
      const final = _.reduce(result, (results, user) => {
      (results[user.email] || (results[user.email] = [])).push(user)
      return results
      },{})
       console.log(final) 

       for(var k in final) {
         const userEmail = k
         const array = final[k]
         console.log(userEmail)
         var array1 = [] ,array2 = [];
        
         for(var d in array) {
           var task=array[d].task
           var taskStatus=array[d].status
           var fullName = array[d].taskList.fullName
           array1.push(task)   
           array2.push(taskStatus)
           
         }
         const separator = ", ";
         var newArray = array1.map((e, i) => 'Task Name :'+ e +separator+ 'Status  :'+ array2[i]);
         const n ='<li>' + newArray.join('</li><li>') +'</li>';
         var str = '<ol>'
         newArray.forEach(function(slide) {
          str += '<li>'+ slide + '</li>';
        }); 
        
        str += '</ol>';
        //statusMail(userEmail,fullName,str)
         console.log(n)
           
       }
        
        
     
  
        res.send('task sent')
  //-----------------------------------------------------------------
      
//   await userSchema.find({}).populate("taskDetails")

//   .then((result) => {

//  const s = JSON.stringify(result,undefined,2)
//  console.log(s)

//  const g = result.taskDetails

//  console.log(g)
 
//  for ( const i in result) { 
//    const email= result[i].email
//    console.log(email)
   
//      for (const r in i) {
  
//    const tsk = result[i].taskDetails[r].task
//    console.log(tsk)
//    console.log(`i.${r} = ${i[r]}`)
   
   
//      }    
     
//    }
//    var t =  _.flatMap(result ,item => 
//     _(item.taskDetails)
//       .filter({createdAt: { $gte: startDate, $lt: endDate }})
//       .map(v => ({email: item.email, task: v.task}))
//       .value()
//   );
//   res.send('task sent')
//   const v = JSON.stringify(t,undefined,2)

 
      
      })
    
      .catch (error => {
         console.log(error.message);
         res.status(500).json({error:error.message})
       })

};
