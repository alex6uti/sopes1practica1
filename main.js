var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var fs = require('fs');
var child_process  = require('child_process');

var prevTotal = 0;
var prevIdle = 0;

//const exec = require('child_process').exec;

server.listen(8081, function() {
  console.log("Servidor corriendo en http://localhost:8081");
});

app.use(express.static('public'));

io.on('connection', function(socket) {
  socket.on('solicitud', function(data){

   //======================================================== RAM
    var path='/proc/meminfo';
    var d = fs.readFileSync(path).toString();
    var datos = d.split(/\n/g);
    var porcentaje_ram_usada = datos[0].split(":")[1].trim().split(" ")[0];
    var porcentaje_ram_libre = datos[1];


    var strRamTotal = datos[0].split(":")[1].trim().split(" ")[0];
    var strRamLibre = datos[1].split(":")[1].trim().split(" ")[0];


    var intRamTotal = parseInt(strRamTotal);
    var intRamLibre = parseInt(strRamLibre);
    var intRamUsada = intRamTotal - intRamLibre;
    var pRamUsada = (intRamUsada / intRamTotal) * 100;

    var outRamTotal = "" + parseFloat(Math.round((intRamTotal / 1024) * 100) / 100).toFixed(2) + " Mb";
    //var outRamTotal = "" + (intRamTotal / 1024) + " Mb";
    var outRamUsada = "" + parseFloat(Math.round((intRamUsada / 1024) * 100) / 100).toFixed(2) + " Mb";
    //var outRamUsada = "" + (intRamUsada / 1024) + " Mb";
    var outPorcentajeUsado = "" + parseFloat(Math.round(pRamUsada * 100) / 100).toFixed(2) + " %";
    

    //======================================================== PROC
    var path2 = '/proc/stat'
    var dCpu = fs.readFileSync(path2).toString();
    var datosCpu = dCpu.split(/\n/g);
    var cpuValores = datosCpu[0].split(" ");

    
    var statUser = parseInt(cpuValores[2]); 
    var statNice = parseInt(cpuValores[3]);
    var statSystem = parseInt(cpuValores[4]);
    var statIdle = parseInt(cpuValores[5]);
    var statIowait = parseInt(cpuValores[6]);
    var statIrq = parseInt(cpuValores[7]);
    var statSoftirq = parseInt(cpuValores[8]);
    var statSteal = parseInt(cpuValores[9]);
    var statGuest = parseInt(cpuValores[10]);
    var statGuestNice = parseInt(cpuValores[11]);


    var idle = statIdle + statIowait;
    var nonIdle = statUser + statNice + statSystem + statIrq + statSoftirq + statSteal;
    var total = idle - nonIdle;

    var totald = total - prevTotal;
    var ideld = idle - prevIdle;

    var cpuPercentage = (totald - ideld)/totald;


    //var outTotalCpuPercentage = ""+prevTotal + "-" + total + "   |   "+prevIdle+"-"+idle;

    prevTotal = total;
    prevIdle = idle;


    var totalCpuTimeSinceBoot = parseInt(cpuValores[2]) + 
                                parseInt(cpuValores[3]) +
                                parseInt(cpuValores[4]) +
                                parseInt(cpuValores[5]) +
                                parseInt(cpuValores[6]) +
                                parseInt(cpuValores[7]) +
                                parseInt(cpuValores[8]) +
                                parseInt(cpuValores[9]);

    var totalCpuIdleTimeSinceBoot = parseInt(cpuValores[5]) +
                                    parseInt(cpuValores[6]);

    var totalCpuUsageTimeSinceBoot = totalCpuTimeSinceBoot - totalCpuIdleTimeSinceBoot;

    var totalCpuPercentage = (totalCpuUsageTimeSinceBoot/totalCpuTimeSinceBoot) * 100;
    
    var outTotalCpuPercentage = "" + parseFloat(Math.round((totalCpuPercentage + cpuPercentage) * 100) / 100).toFixed(2) + "%";
    
    //======================================================== ARBOL PROC

    
    child_process.exec('ps -A -o pid,user,state,%mem,command', (err, stdout, stdin) => {
      if (err) console.log(err);
    

      var jsonArr = [];
      var lines = stdout.split("\n");
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        var pid = line.split(" ")[0];
        line = line.substring(pid.length, line.length).trim();
        var user = line.split(" ")[0];
        line = line.substring(user.length, line.length).trim();
        var state = line.split(" ")[0];
        line = line.substring(state.length, line.length).trim();
        var mem = line.split(" ")[0];
        line = line.substring(mem.length, line.length).trim();
        var command = line;
        jsonArr.push({"pid":pid, "user":user, "state":state, "mem":mem, "name":command});
      }

      var running = 0;
      var unsleep = 0;
      var insleep = 0;
      var zombie = 0;
      var stopped = 0;

      for(var i = 0; i < jsonArr.length; i++){

        switch(jsonArr[i].state.toLowerCase()){
          case 'r':
            running++;
            break;
          case 'd':
            unsleep++;
            break;
          case 's':
            insleep++;
            break;
          case 'z':
            zombie++;
            break;
          case 't':
            stopped++;
            break;
        }
      }

      var myJsonString = JSON.stringify(jsonArr);

      var procTotal = running + unsleep + insleep + zombie + stopped;
      //var val = [];
      //val.push({"total":procTotal ,"r":running, "d":unsleep, "s":insleep, "z":zombie, "t":stopped});

      socket.emit('rprocesos', [{
        "proc":myJsonString,
        "proc_total": procTotal,
        "proc_ejecucion": running,
        "proc_suspendidos": insleep,
        "proc_detenidos": stopped,
        "proc_zombie": zombie
      }]);
      //res.render("detalle.html", {datos:jsonArr, usuario: usuarioActual, nombre: nombreUsuarioActual, val:val});
      }
    );



    socket.emit('respuesta', [{
      "ram_total":outRamTotal,
      "ram_usada":outRamUsada,
      "ram_usada_porcentaje":outPorcentajeUsado,
      "cpu_porcentaje": outTotalCpuPercentage
    }]);

  });


});
