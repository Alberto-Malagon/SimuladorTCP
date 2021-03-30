import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Simulacion } from '../simulacion';
import { faLaptop } from '@fortawesome/free-solid-svg-icons';
import { faServer } from '@fortawesome/free-solid-svg-icons';
import { faBug } from '@fortawesome/free-solid-svg-icons';
import { faPrint } from '@fortawesome/free-solid-svg-icons';
import { Observable, of } from 'rxjs';
import { delay, share } from 'rxjs/operators';
import { NgbPopoverConfig, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorComponent } from '../error/error.component';

// Interfaz de los datos a representar
interface Comunicacion {
  dir: number; // null espacio vacio
  // 0 bidireccional cliente<->servidor con VC en cliente
  // 10 bidireccional cliente<->servidor con VC en servidor
  //  1 direccion cliente->servidor
  //  2 direccion servidor->cliente
  // -1 segmento perdido en direccion cliente->servidor
  // -2 segmento perdido en direccion servidor->cliente
  // -10 segmento perdido en direccion cliente->servidor y flecha servidor->cliente
  // -20 segmento perdido en direccion servidor->cliente y flecha cliente->servidor
  flagcli: string[]; // [SYN, FIN, ACK, AL, EC, RR]
  sncli: number; // numero de secuencia
  ancli: number; // numero de reconocimento
  dcli: number; // tamnyo de lo datos enviados
  wcli: number; // tamanyo de la ventana de recepcion permitida para la entidad contraria
  msscli: number; // maximo tamanyo de segmento
  flagserv: string[]; // [SYN, FIN, ACK, AL, EC, RR]
  snserv: number; // numero de secuencia
  anserv: number; // numero de reconocimento
  dserv: number; // tamnyo de lo datos enviados
  wserv: number; // tamanyo de la ventana de recepcion permitida para la entidad contraria
  mssserv: number; // maximo tamanyo de segmento
  numseg: number; // numero de segmento
  vc: number; // ventana de congestion
  emisor: number; // 1 cliente // 2 servidor
  pqt_rtx: number; //0 no retransmitido // 1 retransmitido
  fin_temp: number; //Indica si el temporizador ha finalizado 0-> Temporizador en marcha 1-> Temporizador finalizado
  umbral: number; //Indica el valor del umbral
  envio: number; //0 = c->s  1 = c<-s
}

// Interfaz para el cliente y el servidor
interface Maquina {
  sn: number; // numero de secuencia
  ult_sn: number; // ultimo numero de secuencia
  an: number; // numero de reconocimento
  ult_an: number; // ultimo numero de reconocimento
  data: number; // tamnyo de lo datos enviados
  w: number; // tamanyo de la ventana de recepcion permitida para la entidad contraria
  segperd: string; // segmentos perdidos
  vc: number; // ventana de congestion
  vcrep: number; // ventana de congestion que se va a mostrar
  flags: string[]; // [SYN, FIN, ACK, AL, EC, RR]
  ec: Boolean; // control de activacion del flag EC
}


@Component({
  selector: 'app-simulacion',
  templateUrl: './simulacion.component.html',
  styleUrls: ['./simulacion.component.css'],
  providers: [NgbPopoverConfig]
})
export class SimulacionComponent implements OnChanges, OnDestroy {

  faLaptop = faLaptop;
  faServer = faServer;
  faBug = faBug;
  faPrint = faPrint;
  comunicacion: Comunicacion[];
  cli: Maquina;
  serv: Maquina;
  ipclien: string = null;
  ipserv: string = null;
  mostrar: Observable<{}>; // Mostrar simulacion o imagen de 'cargando'
  parametros: string = null;
  timeout:number;
  pck = require('../../../package.json');
  host = window.location.href;


  // Obtenemos los datos del componente padre ContenidoComponent
  @Input() simular: Simulacion;

  constructor(private modalService: NgbModal, config: NgbPopoverConfig) {
    // Estilo del popover para reportar un error en la simulacion
    config.placement = 'left';
    config.triggers = 'hover';
  }

  /**
 * @description Cambia el estado de la variable 'mostrar'
 * @author javierorp
 */
  ngOnChanges() {
    this.mostrar = this.generarSimulacion().pipe(share());
  }

  ngOnDestroy() { }

  /**
   * @description Genera la simulacion
   * @author javierorp
   * @returns Observable true si todo ha ido bien o false en caso de algun error
   */
  generarSimulacion(): Observable<boolean> {
    try {
      this.comunicacion = [];
      this.cli = { sn: 0, ult_sn: 0, an: 0, ult_an: 0, data: 0, w: 0, segperd: "", vc: 0, vcrep: 0, flags: [], ec: false };
      this.serv = { sn: 0, ult_sn: 0, an: 0, ult_an: 0, data: 0, w: 0, segperd: "", vc: 0, vcrep: 0, flags: [], ec: false};
      this.ipclien = this.simular.ipclien;
      this.ipserv = this.simular.ipserv;

      if (this.simular.algort == "1")
        this.simularReno();
      else
        this.simularTahoe();

      this.parametros = JSON.stringify(this.simular);
      return of(true).pipe(delay(500));; // Ocultar la imagen de carga y mostrar la simulacion

    } catch (error) {
      const modalRef = this.modalService.open(ErrorComponent, { windowClass: 'modal-entrada' });
      modalRef.componentInstance.desde = "Simulacion";
      modalRef.componentInstance.parametros = JSON.stringify(this.simular);
      modalRef.componentInstance.merror = error;
      return new Observable<false>()
    }
  }

  /**
   * @description Simula utilizando Evitacion de la Congestion
   * @author javierorp
   * @returns
   */
  simularEC(): void {
    /*-----INICIALIZACION-----*/
    // Flags
    //[SYN, FIN, ACK, AL, EC, RR]
    let nullflag: string[] = ["", "", "", "", "", ""];
    let syn: string[] = ["SYN", "", "", "AL", "", ""];
    let synack: string[] = ["SYN", "", "ACK", "AL", "", ""];
    let ack: string[] = ["", "", "ACK", "", "", ""];
    let finack: string[] = ["", "FIN", "ACK", "", "", ""];
    let fin: string[] = ["", "FIN", "", "", "", ""];
    let al: string[] = ["", "", "", "AL", "", ""];
    let rr: string[] = ["", "", "", "", "", "RR"];
    // Cliente
    this.cli.sn = this.simular.snclien;
    this.cli.ult_sn = 0;
    this.cli.an = 0;
    this.cli.ult_an = 0;
    this.cli.data = this.simular.datosclien;
    this.cli.w = this.simular.wclien;
    this.cli.segperd = this.simular.segperdclien;
    this.cli.vc = 1;
    this.cli.vcrep = 1;
    this.cli.flags = syn;
    this.cli.ec = false;
    // Servidor
    this.serv.sn = this.simular.snserv;
    this.serv.ult_sn = 0;
    this.serv.an = 0;
    this.serv.ult_an = 0;
    this.serv.data = this.simular.datosserv;
    this.serv.w = this.simular.wserv;
    this.serv.segperd = this.simular.segperdserv;
    this.serv.vc = 1;
    this.serv.vcrep = 1;
    this.serv.flags = synack;
    this.serv.ec = false;
    // General
    let timeout: number = this.simular.timeout;
    let umbral: number = this.simular.umbral;
    let algort: string = this.simular.algort;
    let cierre: string = this.simular.cierre;
    /*-----VARIABLES-----*/
    // General
    let mss: number = Math.min(this.simular.mssclien, this.simular.mssserv); // Se elige el minimo MSS
    let nseg: number = 0;
    let denv: number = mss; // Datos a enviar
    // Cliente
    let mssClien: number = Math.min(mss, this.serv.w);
    let numPqtClien: number = Math.floor(this.cli.data / mssClien);
    let numPqtClienEnv: number = 0;
    let modPqtClien: number = this.cli.data % mssClien;
    let envMaxClien: number = Math.floor(this.serv.w / mssClien);
    //Servidor
    let mssServ: number = Math.min(mss, this.cli.w);
    let numPqtServ: number = Math.floor(this.serv.data / mssServ);
    let numPqtServEnv: number = 0;
    let modPqtServ: number = this.serv.data % mssServ;
    let envMaxServ: number = Math.floor(this.cli.w / mssServ);
    // ----- Conexion -----
    // Enviamos los segmentos de SYN; SYN, ACK; y ACK
    this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: 0, dcli: 0, wcli: this.cli.w, msscli: this.simular.mssclien, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1,pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
    this.serv.ult_an = this.serv.an;
    this.serv.an = this.cli.sn + 1;
    this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: this.simular.mssserv, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
    this.serv.flags = nullflag;
    this.cli.ult_sn = this.cli.sn;
    this.cli.sn += 1;
    this.cli.ult_an = this.cli.an;
    this.cli.an = this.serv.sn + 1;
    this.cli.flags = ack;
    this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
    this.cli.flags = nullflag;

    // >>>>> Envio de datos cliente->servidor <<<<<
    if (numPqtClien == 0)
      denv = modPqtClien;
    else
      denv = mssClien;
    // El cliente envía el primer paquete
    this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
    numPqtClienEnv++;

    if (numPqtClien != 0) // Si hay mas de un paquete a enviar
    {
      // El servidor espera 2 ticks por si recibe otro paquete
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});

      // El servidor manda el ACK del primer paquete
      this.serv.flags = ack;
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += 1;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + denv;
      this.incrementarVC(this.cli, this.serv, mssClien);
      this.comprobarEC(this.cli, umbral);
      //ACK
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
      this.cli.ult_an = this.serv.an;
    }
    let envAck: number = 0; // Cada dos paquetes enviados por el cliente, el servidor devuelve un ACK
    let ultDataEnv: number = denv; // Tamanyo de los ultimos datos enviados
    for (; numPqtClienEnv <= numPqtClien; numPqtClienEnv++) { //Segmentos enviados a partir del primero

      if (envAck == Math.min(this.cli.vcrep, envMaxClien)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
      {
        this.serv.flags = ack;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        let inc: number = this.cli.ult_sn - this.serv.ult_an;
        this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
        this.incrementarVC(this.cli, this.serv, mssClien);
        this.comprobarEC(this.cli, umbral);
        //ACK
        this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        numPqtClienEnv--;
        envAck = 0;
      }
      else if (envAck < 2 && denv !=0 ) // El numero de paquetes enviados no alcanza al ACK
      {
        this.serv.flags= nullflag;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.comprobarEC(this.cli, umbral);
        this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 , emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
        this.cli.ult_sn = this.cli.sn;
        ultDataEnv = denv;
        envAck++;
      }
      else if (denv !=0){ // Cada 2 paquetes enviados por el cliente, el servidor envia un ACK mientras el cliente envía datos (flechas cruzadas)
        this.serv.flags = ack;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
        this.incrementarVC(this.cli, this.serv, mssServ);
        this.comprobarEC(this.cli, umbral);
        this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
        ultDataEnv = denv;
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        envAck = 1;// Con el ACK se envía otro paquete , por lo que hay un paquete sin reconocer => envAck=1
      }
      if (numPqtClienEnv == numPqtClien - 1){ // Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
          if (modPqtClien!=0)
            denv = modPqtClien;
          else
            numPqtClienEnv += 99;
      }
      if (envAck == 2 && numPqtClienEnv + 1 >= numPqtClien && modPqtClien == 0) // Si es el ultimo paquete a enviar y no hay mas datos a enviar salimos del bucle
        numPqtClienEnv += 99;
    }
//##########################################################################################################################################################################################################################
    // El servidor espera 2 ticks por si recibe otro paquete
    if (envAck != 2)
    {
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
    }
    // El servidor envia el primer paquete de datos junto al ACK del ultimo paquete
    if (envAck != 0 || (envAck == 0 && modPqtClien != 0)) { // Si el ACK no se ha enviado ya
      if (envAck == 0 && modPqtClien != 0) {
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += denv;
      }
      this.serv.flags=ack;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.ult_sn + denv;
      if (numPqtServ == 0) // Si el servidor sólo tiene que enviar un paquete
        denv = modPqtServ;
      else
        denv = mssServ;
      this.serv.ult_sn = this.serv.sn;
      this.incrementarVC(this.cli, this.serv, mssClien);
      this.comprobarEC(this.cli, umbral);
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
      this.cli.ult_sn = this.cli.sn;
      this.cli.ult_an = this.cli.an;
      this.cli.an++;
      this.serv.ult_an = this.serv.an;
      this.cli.flags = nullflag;
      numPqtServEnv++;
    }

    // >>>>> Envio de datos servidor->cliente <<<<<
    if (numPqtServ != 0) // Si hay mas de un paquete a enviar
    {
      // El cliente espera 2 ticks por si recibe otro paquete
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});

      // El cliente manda el ACK del primer paquete
      this.cli.flags = ack;
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn = this.serv.ult_an;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + denv;
      this.incrementarVC(this.serv, this.cli, mssServ);
      this.comprobarEC(this.serv, umbral);
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
      this.serv.ult_an = this.serv.an;
    }
    else {
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn = this.serv.ult_an;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + denv;
    }

    ultDataEnv = denv; // Tamanyo de los ultimos datos enviados
    envAck = 0;
    for (; numPqtServEnv <= numPqtServ; numPqtServEnv++) {

      if (envAck == Math.min(this.serv.vcrep, envMaxServ)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
      {
        this.cli.flags = ack;
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        let inc: number = this.serv.ult_sn - this.cli.ult_an;
        this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
        this.incrementarVC(this.serv, this.cli, mssServ);
        this.comprobarEC(this.serv, umbral);
        this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        numPqtServEnv--;
        envAck = 0;
      }
      else if (envAck < 2) // El numero de paquetes enviados no alcanza al ACK
      {
        this.serv.ult_sn = this.serv.sn;
        this.serv.sn += ultDataEnv;
        this.comprobarEC(this.serv, umbral);
        this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
        this.serv.ult_sn = this.serv.sn;
        ultDataEnv = denv;
        envAck++;
      }
      else  { // Cada 2 paquetes enviados por el servidor, el cliente envía ack y el servidor envía datos (flechas cruzadas)
        this.serv.ult_sn = this.serv.sn;
        this.serv.sn += ultDataEnv;
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
        this.incrementarVC(this.serv, this.cli, mssServ);
        this.comprobarEC(this.serv, umbral);
        this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
        ultDataEnv = denv;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        envAck = 1;
      }

      if (numPqtServEnv == numPqtServ - 1){ // Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
          if (modPqtServ!=0)
            denv = modPqtServ;
          else
            numPqtServEnv += 99;
          }
      if (envAck == 2 && numPqtServEnv + 1 >= numPqtServ && modPqtServ == 0) // Si es el ultimo paquete a enviar y no hay mas datos a enviar salimos del bucle
        numPqtServEnv += 99;
    }

    // El cliente espera 2 ticks por si recibe otro paquete
    if (envAck != 2)
    {
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:2 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
    }
    // El cliente envia el ACK del ultimo paquete
    if (envAck != 0 || (envAck == 0 && numPqtServEnv == 1)) { // Si el ACK no se ha enviado ya
      if (envAck != 0){
        this.cli.ult_an = this.cli.an;
        this.cli.an = this.serv.ult_sn + denv;
      }
      this.cli.ult_sn = this.cli.sn;
      this.incrementarVC(this.serv, this.cli, mssServ);
      this.comprobarEC(this.serv, umbral);
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
      this.serv.ult_sn = this.serv.sn;
      this.serv.ult_an = this.serv.an;
      this.cli.ult_an = this.cli.an;
    }

    // El cliente espera 2 tick por si hay intercambio de informacion y luego se procede a cerrar
    if (envAck == 2 && cierre == "1")
    {
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:1});
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:1});
    }

    // ----- Cierre -----
    // Enviamos los segmentos de FIN; FIN, ACK; y ACK
    if (cierre == "1") { // El cliente cierra la conexion
      //FIN
      this.cli.ult_sn = this.cli.sn;
      this.cli.flags = fin;
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
      // FIN, ACK
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += denv;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + 1;
      this.serv.flags = finack;
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0 ,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
      // ACK
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn++;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + 1;
      this.cli.flags = ack;
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral , envio:0});

    } else { // El servidor cierra la conexion
      // FIN
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += denv;
      this.serv.ult_an = this.serv.an;
      this.serv.flags = fin;
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
      // FIN, ACK
      this.cli.ult_sn = this.cli.sn;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + 1;
      this.cli.flags = finack;
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
      // ACK
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn++;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + 1;
      this.serv.flags = ack;
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
    }

  }


  /**
   * @description Comprobar si se activa o no EC
   * @author javierorp
   * @param maq Objeto del tipo Maquina que sera modificado
   * @param umbral Umbral utilizado en la simulacion
   * @returns maq
   */
  comprobarEC(maq: Maquina, umbral: number): Maquina {
    let ec: string[] = ["", "", "", "", "EC", "", ""];
    let nullflag: string[] = ["", "", "", "", "", ""];

    if (maq.ec == true || maq.vc < umbral) // EC ya ha sido activado
      maq.flags = nullflag
    else {
      maq.ec = true;
      maq.flags = ec;
    }
    return maq;
  }


  /**
   * @description Incrementar la ventana de congestion o no y de que forma
   * @author javierorp
   * @param maqVC receptor, del tipo Maquina
   * @param maqACK emisor, del tipo Maquina
   * @param mss MSS utilizado en la simulacion
   * @returns  maqVC
   */
  incrementarVC(maqVC: Maquina, maqACK: Maquina, mss: number): Maquina {
    if (maqVC.ec == false) { // EC desactivado
      maqVC.vc += Math.ceil((maqACK.an - maqACK.ult_an) / mss);
      maqVC.vcrep = maqVC.vc;
    }
    else {
      let tramas: number = Math.ceil((maqACK.an - maqACK.ult_an) / mss);

      for (let i = 1; i <= tramas; i++) {
        maqVC.vc = maqVC.vc + 1 / Math.floor(maqVC.vc);
      }
      maqVC.vcrep = Math.round((maqVC.vc + Number.EPSILON) * 100) / 100;
    }

    return maqVC;
  }


  /**
   * TODO: implementar la simulacion utilizando TCP Reno
   * @description Simula utilizando como algoritmo de congestion Reno
   * @author javierorp
   * @returns
   */
  simularReno(): void {
    this.simularEC();
    return;
  }


  /**
   * TODO: implementar la simulacion utilizando TCP Tahoe
   * @description Simula utilizando como algoritmo de congestion Tahoe
   * @author javierorp
   * @returns
   */
  simularTahoe(): void {
    /*-----INICIALIZACION-----*/
    // Flags
    //[SYN, FIN, ACK, AL, EC, RR]
    let nullflag: string[] = ["", "", "", "", "", "",""];
    let syn: string[] = ["SYN", "", "", "AL", "", "",""];
    let synack: string[] = ["SYN", "", "ACK", "AL", "", "",""];
    let ack: string[] = ["", "", "ACK", "", "", "",""];
    let finack: string[] = ["", "FIN", "ACK", "", "", "",""];
    let fin: string[] = ["", "FIN", "", "", "", "",""];
    let al: string[] = ["", "", "", "AL", "", "",""];
    let rr: string[] = ["", "", "", "", "", "RR",""];
    // Cliente
    this.cli.sn = this.simular.snclien;
    this.cli.ult_sn = 0;
    this.cli.an = 0;
    this.cli.ult_an = 0;
    this.cli.data = this.simular.datosclien;
    this.cli.w = this.simular.wclien;
    this.cli.segperd = this.simular.segperdclien;
    this.cli.vc = 1;
    this.cli.vcrep = 1;
    this.cli.flags = syn;
    this.cli.ec = false;
    // Servidor
    this.serv.sn = this.simular.snserv;
    this.serv.ult_sn = 0;
    this.serv.an = 0;
    this.serv.ult_an = 0;
    this.serv.data = this.simular.datosserv;
    this.serv.w = this.simular.wserv;
    this.serv.segperd = this.simular.segperdserv;
    this.serv.vc = 1;
    this.serv.vcrep = 1;
    this.serv.flags = synack;
    this.serv.ec = false;
    // General
    let timeout = this.simular.timeout;
    let umbral: number = this.simular.umbral;
    let algort: string = this.simular.algort;
    let cierre: string = this.simular.cierre;
    /*-----VARIABLES-----*/
    // General
    let mss: number = Math.min(this.simular.mssclien, this.simular.mssserv); // Se elige el minimo MSS
    let nseg: number = 0;
    let denv: number = mss; // Datos a enviar
    // Cliente
    let mssClien: number = Math.min(mss, this.serv.w);
    let numPqtClien: number = Math.floor(this.cli.data / mssClien);
    let numPqtClienEnv: number = 0; //Indica los pqt enviados (para saber cuando terminar)
    let contadorPqtEnv: number =0;  //Indica los pqt enviados (para comparar con los segmentos perdidos)
    let modPqtClien: number = this.cli.data % mssClien;
    let envMaxClien: number = Math.floor(this.serv.w / mssClien);
    //Servidor
    let mssServ: number = Math.min(mss, this.cli.w);
    let numPqtServ: number = Math.floor(this.serv.data / mssServ);
    let numPqtServEnv: number = 0;
    let modPqtServ: number = this.serv.data % mssServ;
    let envMaxServ: number = Math.floor(this.cli.w / mssServ);

    let pqtPerdido: number =0; //0 Si no hay pqt perdido o se ha retransmitido  1 Si hay paquete perdido sin retransmitir
    //Se comprueba que el número del segmento perdido es menor o igual que el numero de segmentos que se van a enviar
    if (this.simular.segperdclien != null)
    {
    var segperdNumclien = this.simular.segperdclien.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico
    var numElementosclien = segperdNumclien.length; // Devuelve el numero de elementos del array
    let z :number =0;
    for (z=0;z<numElementosclien-1;z++)
    {
      if (segperdNumclien[z]>numPqtClien)
          segperdNumclien [z]==null;
    }
   
  }
    //Se comprueba que el número del segmento perdido es menor o igual que el numero de segmentos que se van a enviar
   if (this.simular.segperdserv != null)
   {
    var segperdNumserv = this.simular.segperdserv.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico
    var numElementosserv = segperdNumserv.length; // Devuelve el numero de elementos del array
    let z :number =0;
    for (z=0;z<numElementosserv-1;z++)
    {
      if (segperdNumserv[z]>numPqtServ)
          segperdNumserv [z]==null;
    }
  }
    // ----- Conexion -----
    // Enviamos los segmentos de SYN; SYN, ACK; y ACK
    this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: 0, dcli: 0, wcli: this.cli.w, msscli: this.simular.mssclien, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
    this.serv.ult_an = this.serv.an;
    this.serv.an = this.cli.sn + 1;
    this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: this.simular.mssserv, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
    this.serv.flags = nullflag;
    this.cli.ult_sn = this.cli.sn;
    this.cli.sn += 1;
    this.cli.ult_an = this.cli.an;
    this.cli.an = this.serv.sn + 1;
    this.cli.flags = ack;
    this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
    this.cli.flags = nullflag;
// ----------------------------- LADO CLIENTE -----------------------------------------   
 // >>>>> Envio de datos cliente->servidor <<<<<
    if (numPqtClien == 0)
      denv = modPqtClien;
    else
      denv = mssClien;
    //PRIMER SEGMENTO
    //#########################
    // >>>>> Si el primer segmento se pierde <<<<<
    let x: number=0;
    let y: number=0;
    let reconocido: number = 0; //1--> El segmento perdido no ha sido reconocido  0--> El segmento perdido ha sido reconocido
    let sn_perd: number;
    let an_perd: number;
    let d_perd: number;
    let envAck: number = 0; // Cada dos paquetes enviados por el cliente, el servidor devuelve un ACK
    let ultDataEnv: number = denv; // Tamanyo de los ultimos datos enviados
    let ACK_inm: number = 0;
    let ACK_dup: number =0;
    if (this.simular.segperdclien != null && contadorPqtEnv+1==segperdNumclien[x])
    {
      x++;
      this.cli.flags=nullflag;
      sn_perd = this.cli.sn;
      an_perd = this.cli.an;
      d_perd = denv;
      this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
      contadorPqtEnv++;
      timeout= this.simular.timeout;
      reconocido=1;
      pqtPerdido=1;
      timeout--;
    }
    else 
    {
    // El cliente envía el primer paquete
    this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
    numPqtClienEnv++;
    contadorPqtEnv++;
    }
    //SI HAY SEGMENTO PENDIENTE DE REENVÍO SE REENVÍA O SE ESPERA A QUE VENZA EL TIMER
    if (pqtPerdido==1)
    {
      for(;pqtPerdido==1;)
      {
        if (timeout==0)//REENVÍO DEL PAQUETE
        {
          if (envAck < 2 && denv !=0 )
          {
          this.cli.vcrep+=1;
          this.cli.vc+=1;
          this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc:0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
          reconocido=0;
          ACK_inm = 1;
          pqtPerdido=0;
          }  
        }
        else
        {
          timeout--;
          if (timeout==0)
          {
            umbral = Math.floor(this.cli.vcrep/2);
            if (umbral==0)umbral=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.cli.ec = false;
            this.cli.flags = nullflag;
            this.comunicacion.push({ numseg: null, dir: null, flagcli: al, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbral, envio:0});
          }
          else
            this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
        }
      }
    }
    //ACK PRIMER PAQUETE
    //#####################
    if (numPqtClien != 0 && segperdNumclien[0]!=1) // Si hay mas de un paquete a enviar
    {
      // El servidor espera 1 tick por si recibe otro paquete
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});

      // El servidor manda el ACK del primer paquete
      this.serv.flags = ack;
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += 1;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + denv;
      this.incrementarVC(this.cli, this.serv, mssClien);
      this.comprobarEC(this.cli, umbral);
      //ACK
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2 , pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
      this.cli.ult_an = this.serv.an;
    }

    //RESTO DE PAQUETES
    //############################
  for (; numPqtClienEnv <= numPqtClien; numPqtClienEnv++) { //Segmentos enviados a partir del primero
    let x: number=0;
    //REENVÍO PAQUETE PERDIDO
    if ((this.simular.segperdclien != null && timeout==0 && pqtPerdido==1) || (this.simular.segperdclien != null && ACK_dup==3 && pqtPerdido==1))
    {
      if (this.simular.segperdclien != null && timeout==0 && pqtPerdido==1)
      {
        if (envAck < 2 && denv !=0 )
        {
        this.cli.vcrep+=1;
        this.cli.vc+=1;
        this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }  
        else if (denv !=0) //FLECHAS CRUZADAS
        {
        this.cli.vcrep+=1;
        this.cli.vc+=1;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }
      }
      else // 3 ACK'S DUPLICADOS
      {
        if (envAck < 2 && denv !=0 )
        {
        umbral = this.cli.vc / 2;
        this.cli.vc=umbral + 3;
        this.cli.vcrep=this.cli.vc;
        this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: al, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbral, envio:0});
        this.cli.vc++;
        this.cli.vcrep++;
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }  
        else if (denv !=0) //FLECHAS CRUZADAS
        {
        umbral = this.cli.vc / 2;
        this.cli.vc=umbral + 3;
        this.cli.vcrep=this.cli.vc;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: al, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbral, envio:0});
        this.cli.vc++;
        this.cli.vcrep++;
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }
      }
    }
      //ACK inmediato
      else if (ACK_inm==1)
      {
        
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
        this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
        this.serv.flags = ack;
        this.incrementarVC(this.cli, this.serv, mssClien);
        this.comprobarEC(this.cli, umbral);
        this.serv.ult_an = this.serv.an;
        this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
        numPqtClienEnv--; // HACE QUE EL SEGMENTO PERDIDO SE REPITA DOS VECES!! Solucionado con contadorPqtEnv
        envAck = 0; 
        ACK_inm=0;
        ACK_dup = 0;
      }
      //ACK
      else if (envAck == Math.min(this.cli.vcrep, envMaxClien)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
      {
        if (reconocido==0)
        {
          timeout --;
          this.serv.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          let inc: number = this.cli.ult_sn - this.serv.ult_an;
          this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
          this.incrementarVC(this.cli, this.serv, mssClien);
          this.comprobarEC(this.cli, umbral);
          if(timeout==0 && pqtPerdido==1)
          {
            umbral = Math.floor(this.cli.vcrep/2); 
            if (umbral==0)umbral=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.cli.ec = false;
            this.cli.flags = nullflag;
            this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: al, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbral, envio:0 });
          }
          else
            this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          numPqtClienEnv--; // HACE QUE EL SEGMENTO PERDIDO SE REPITA DOS VECES!! Solucionado con contadorPqtEnv
          envAck = 0;
        }
        else if (reconocido==1)
        {
          timeout --;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          let inc: number = this.cli.ult_sn - this.serv.ult_an;
          this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
          this.serv.ult_an = this.serv.an;
          this.serv.flags = ack;
          this.incrementarVC(this.cli, this.serv, mssClien);
          this.comprobarEC(this.cli, umbral);
          if(timeout==0 && pqtPerdido==1)
          {
            umbral = Math.floor(this.cli.vcrep/2);
            if (umbral==0)umbral=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.cli.ec = false;
            this.cli.flags = nullflag;
            this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: al, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:1,umbral:umbral, envio:0});
          }
          else
            this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
          ACK_dup++;
          numPqtClienEnv--; // HACE QUE EL SEGMENTO PERDIDO SE REPITA DOS VECES!! Solucionado con contadorPqtEnv
          envAck = 0; 
        }
      }
      //SEGMENTOS PERDIDOS
      else if (this.simular.segperdclien!= null && contadorPqtEnv+1==segperdNumclien[x])
      {
        x++;
        this.cli.flags=nullflag;
        // Caso segmento perdido en la dirección cliente -> servidor
        if (envAck < 2 && denv !=0)
        {
        this.serv.flags= nullflag;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.serv.flags= nullflag;
        this.comprobarEC(this.cli, umbral);
        sn_perd = this.cli.sn;
        an_perd = this.cli.an;
        d_perd = denv;
        this.serv.an += ultDataEnv;
        this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
        ultDataEnv = denv;
        contadorPqtEnv++;
        numPqtClienEnv--;
        timeout=this.simular.timeout;
        reconocido=1;
        pqtPerdido=1;
        timeout--;
        }
        else if (denv !=0) // SEGMENTO PERDIDO (FLECHAS CRUZADAS)
        {
        this.serv.flags = ack;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
        this.incrementarVC(this.cli, this.serv, mssClien);
        this.comprobarEC(this.cli, umbral);
        sn_perd = this.cli.sn;
        an_perd = this.cli.an;
        d_perd = denv;
        this.serv.an += ultDataEnv;
        this.comunicacion.push({ numseg: ++nseg, dir: -10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
        contadorPqtEnv++;
        numPqtClienEnv--;
        envAck = 0;
        timeout=this.simular.timeout;
        reconocido=1;
        pqtPerdido=1;
        timeout--;
      }
      }
      //PAQUETES DE DATOS
      else if (envAck < 2 && denv !=0 ) // El numero de paquetes enviados no alcanza al ACK
      {
        timeout --;
        this.serv.flags= nullflag;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.comprobarEC(this.cli, umbral);
        if(timeout==0 && pqtPerdido==1)
        { 
          umbral = Math.floor(this.cli.vcrep/2); 
          if (umbral==0)umbral=1;
          this.cli.vcrep=1;
          this.cli.vc=1;
          this.cli.ec = false;
          this.cli.flags = nullflag;
          this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: al, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbral, envio:0});
        }
        else
          this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 , emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
        this.cli.ult_sn = this.cli.sn;
        ultDataEnv = denv;
        envAck++;
        contadorPqtEnv++;      
      }
      //ACK Y DATOS 
      else if (denv !=0){ // Cada 2 paquetes enviados por el cliente, el servidor envia un ACK mientras el cliente envía datos (flechas cruzadas)
        if (reconocido==0)
        {  
          timeout--;
          this.serv.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.sn += ultDataEnv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
          this.incrementarVC(this.cli, this.serv, mssServ);
          this.comprobarEC(this.cli, umbral);
          if(timeout==0 && pqtPerdido==1)
          { 
            umbral = Math.floor(this.cli.vcrep/2);
            if (umbral==0)umbral=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.cli.ec = false;
            this.cli.flags = nullflag;
            this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: al, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbral, envio:0});
          }
          else
            this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
          ultDataEnv = denv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          envAck = 1;// Con el ACK se envía otro paquete , por lo que hay un paquete sin reconocer => envAck=1
          contadorPqtEnv++;
        }
        else if (reconocido==1)
        {
          timeout--;
          this.serv.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.sn += ultDataEnv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
          this.incrementarVC(this.cli, this.serv, mssServ);
          this.comprobarEC(this.cli, umbral);
          if(timeout==0 && pqtPerdido==1)
          { 
            umbral = Math.floor(this.cli.vcrep/2); 
            if (umbral==0)umbral=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.cli.ec = false;
            this.cli.flags = nullflag;
            this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: al, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbral, envio:0});
          }
          else
            this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
          ultDataEnv = denv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          ACK_dup++;
          envAck = 1;// Con el ACK se envía otro paquete , por lo que hay un paquete sin reconocer => envAck=1
          contadorPqtEnv++;
        }

      }
      if (numPqtClienEnv == numPqtClien - 1){ // Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
          if (modPqtClien!=0)
            denv = modPqtClien;
          else
            numPqtClienEnv += 99;
      }
    }
    //SI HAY SEGMENTO PENDIENTE DE REENVÍO SE REENVÍA O SE ESPERA A QUE VENZA EL TIMER
    if (pqtPerdido==1)
    {
      for(;pqtPerdido==1;)
      {
      if (timeout==0)//REENVÍO DEL PAQUETE
      {
        if (envAck < 2 && denv !=0 )
        {
        //this.cli.vcrep+=1;
        //this.cli.vc+=1;
        this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbral, envio:0});
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }  
        else if (denv !=0) //FLECHAS CRUZADAS
        {
        //this.cli.vcrep+=1;
        //this.cli.vc+=1;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbral, envio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }
      }
      else
      {
        timeout--;
        if (timeout==0)
        {
          umbral = Math.floor(this.cli.vcrep/2);
          if (umbral==0)umbral=1;
          this.cli.vcrep=1;
          this.cli.vc=1;
          this.cli.ec = false;
          this.cli.flags = nullflag;
          this.comunicacion.push({ numseg: null, dir: null, flagcli: al, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbral, envio:0});
          
        }
        else
          this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
      }
      }
    }
    // El servidor espera 1 tick por si recibe otro paquete
    if (envAck != 2 && ACK_inm!=1)
    {
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:1});
    }
    // ----------------------------- LADO SERVIDOR -----------------------------------------
    contadorPqtEnv=0;
    numPqtServEnv=0;
    // El servidor envia el primer paquete de datos junto al ACK del ultimo paquete
    if (envAck != 0 || (envAck == 0 && modPqtClien != 0)) { // Si el ACK no se ha enviado ya
      if (envAck == 0 && modPqtClien != 0) {
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += denv;
      }
      this.serv.flags=ack;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.ult_sn + denv;
      if (numPqtServ == 0) // Si el servidor sólo tiene que enviar un paquete
        denv = modPqtServ;
      else
        denv = mssServ;
      this.serv.ult_sn = this.serv.sn;
      this.incrementarVC(this.cli, this.serv, mssClien);
      this.comprobarEC(this.cli, umbral);
      //Si el primer paquete se pierde
      for (;numPqtServEnv<1;)
      {
        if (this.simular.segperdserv != null && contadorPqtEnv+1==segperdNumserv[y])
        {
          y++;
          this.serv.flags = ack;
          timeout = this.simular.timeout;
          sn_perd = this.serv.sn;
          an_perd = this.serv.an;
          d_perd = denv;
          this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:1});
          contadorPqtEnv++;
          reconocido = 1;
          pqtPerdido = 1;
          timeout--;
        }
        else if (pqtPerdido != 1)
        {
          this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:1});
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an++;
          this.serv.ult_an = this.serv.an;
          this.cli.flags = nullflag;
          contadorPqtEnv++;
          numPqtServEnv++;
          ACK_inm=0;
          this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
        }
        if (pqtPerdido == 1 && timeout != 0)
        {
          timeout--;
          if (timeout==0)
          {
            this.serv.vcrep=1;
            this.serv.vc=1;
            this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: al, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbral, envio:1 });
          }
            else
            this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
        }
        if (pqtPerdido == 1 && timeout ==0) //REENVÍO PRIMER PAQUETE SERVIDOR --> CLIENTE
        {
          this.serv.flags=nullflag;
          this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: ack, snserv: sn_perd, anserv: an_perd, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:1});
          contadorPqtEnv++;
          numPqtServEnv++;
          pqtPerdido=0;
          // El cliente espera 1 tick por si recibe otro paquete
          this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
        }
    
    // >>>>> Envio de datos servidor->cliente <<<<<
    if (numPqtServ != 0 && pqtPerdido !=1) // ACK -->Si hay mas de un paquete a enviar
    {
      // El cliente manda el ACK del primer paquete
      this.cli.flags = ack;
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn = this.serv.ult_an;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + denv;
      this.incrementarVC(this.serv, this.cli, mssServ);
      this.comprobarEC(this.serv, umbral);
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
      this.serv.ult_an = this.serv.an;
      contadorPqtEnv++;
      reconocido = 0;
    }
    else if (numPqtServ == 0 && pqtPerdido !=1) {
      
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn = this.serv.ult_an;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + denv;
    }
  }
}
    ultDataEnv = denv; // Tamanyo de los ultimos datos enviados
    envAck = 0;
  for (; numPqtServEnv <= numPqtServ; numPqtServEnv++) {
      //REENVÍO PAQUETE PERDIDO
    if ((this.simular.segperdserv != null && timeout==0 && pqtPerdido==1 )|| (this.simular.segperdclien != null && ACK_dup==3 && pqtPerdido==1))
    {
        if (this.simular.segperdserv != null && timeout==0 && pqtPerdido==1 ) // FIN TIMEOUT
        {
        if (envAck < 2)
        {
          this.serv.vcrep+=1;
          this.serv.vc+=1;
          this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
        else    //Flechas Cruzadas
        {
          this.serv.vcrep+=1;
          this.serv.vc+=1;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
      }
      else // 3 ACK'S DUPLICADOS
      {
        if (envAck < 2)
        {
          this.serv.ec = false;
          umbral = this.serv.vc/2;
          this.serv.vc=umbral+3;
          this.serv.vcrep= this.serv.vc;
          this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: al, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbral, envio:1 });
          this.serv.vc++;
          this.serv.vcrep++;
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
        else    //Flechas Cruzadas
        {
          this.serv.ec=false;
          umbral = this.serv.vc/2;
          this.serv.vc=umbral+3;
          this.serv.vcrep= this.serv.vc;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: al, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:1, fin_temp:0,umbral:umbral, envio:1 });
          this.serv.vc++;
          this.serv.vcrep++;
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
      }
    }
      //ACK INMEDIATO
      else if (ACK_inm==1)
      {
        this.cli.flags = ack;
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        let inc: number = Math.abs(this.serv.ult_sn - this.cli.ult_an);
        this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
        this.incrementarVC(this.serv, this.cli, mssServ);
        this.comprobarEC(this.serv, umbral);
        this.cli.ult_an = this.cli.an;
        this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
        numPqtServEnv--;
        envAck = 0;
        ACK_inm = 0;
        ACK_dup = 0;
      }
      //ACK
      else if (envAck == Math.min(this.serv.vcrep, envMaxServ)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
      {
        if (reconocido==0)
        {
          timeout--;
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = this.serv.ult_sn - this.cli.ult_an;
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbral);
          if(timeout==0 && pqtPerdido==1)
          {
            umbral = Math.floor(this.serv.vcrep/2);
            if (umbral==0)umbral=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.serv.ec = false;
            this.serv.flags = nullflag;
            this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: al, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbral, envio:1 });
          }
          else 
            this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          numPqtServEnv--;
          envAck = 0;
        }
        else if (reconocido==1)
        {
          timeout--;
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = this.serv.ult_sn - this.cli.ult_an;
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          this.cli.ult_an = this.cli.an;
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbral);
          if(timeout==0 && pqtPerdido==1)
          {
            umbral = Math.floor(this.serv.vcrep/2);
            if (umbral==0)umbral=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.serv.ec = false;
            this.serv.flags = nullflag;
            this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: al, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbral, envio:1 });
          }
          else 
            this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
          ACK_dup++;
          numPqtServEnv--;
          envAck = 0; 
        }
      }
      //SEGMENTOS PERDIDOS
      else if (this.simular.segperdserv!= null && contadorPqtEnv==segperdNumserv[y])
      {
        y++;
        this.serv.flags=nullflag;
        if (envAck < 2) // Segmento perdido dirección servidor --> cliente
        {
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.comprobarEC(this.serv, umbral);
          sn_perd = this.serv.sn;
          an_perd = this.serv.an;
          d_perd = denv;
          this.cli.an += ultDataEnv;
          this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
          this.serv.ult_sn = this.serv.sn;
          ultDataEnv = denv;
          contadorPqtEnv++;
          numPqtServEnv--;
          timeout = this.simular.timeout;
          reconocido = 1;
          pqtPerdido = 1;
          timeout--;
        }
        else //Segmento perdido bidireccional (FLECHAS CRUZADAS)
        {
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbral);
          sn_perd = this.serv.sn;
          an_perd = this.serv.an;
          d_perd = denv;
          this.cli.an += ultDataEnv;
          this.comunicacion.push({ numseg: ++nseg, dir: -20, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
          contadorPqtEnv++;
          numPqtServEnv--;
          timeout = this.simular.timeout;
          reconocido = 1;
          pqtPerdido = 1;
          envAck = 0; 
          timeout--;
        }
      }
      //DATOS
      else if (envAck < 2) // El numero de paquetes enviados no alcanza al ACK
      {
        timeout--;
        this.cli.flags = nullflag;
        this.serv.ult_sn = this.serv.sn;
        this.serv.sn += ultDataEnv;
        this.comprobarEC(this.serv, umbral);
        if(timeout==0 && pqtPerdido==1)
        {
          umbral = Math.floor(this.cli.vcrep/2);
          if (umbral==0)umbral=1;
          this.serv.vcrep = 1;
          this.serv.vc = 1;
          this.serv.ec = false;
          this.serv.flags = nullflag;
          this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: al, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbral, envio:1 });
        }
        else
          this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
        this.serv.ult_sn = this.serv.sn;
        ultDataEnv = denv;
        envAck++;
        contadorPqtEnv++;
      }
      //ACK Y DATOS
      else  { // Cada 2 paquetes enviados por el servidor, el cliente envía ack y el servidor envía datos (flechas cruzadas)
        if (reconocido==0)
        {
          timeout--;
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbral);
          if (timeout==0 && pqtPerdido==1)
          {
            umbral = Math.floor(this.serv.vcrep/2);
            if (umbral==0)umbral=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.serv.ec = false;
            this.serv.flags = nullflag;
            this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: al, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbral, envio:1 });
          }
          else
            this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
          ultDataEnv = denv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          envAck = 1;
          contadorPqtEnv++;
        }
        else if (reconocido == 1)
        {
          timeout --;
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbral);
          if (timeout==0 && pqtPerdido==1)
          {
            umbral = Math.floor(this.serv.vcrep/2);
            if (umbral==0)umbral=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.serv.ec = false;
            this.serv.flags = nullflag;
            this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: al, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbral, envio:1 });
          }
          else
            this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
          ultDataEnv = denv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          ACK_dup++;
          envAck = 1;
          contadorPqtEnv++;
        }
      }
      if (numPqtServEnv == numPqtServ - 1){ // Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
        if (pqtPerdido == 1)
            numPqtServEnv += 99;  
        if (modPqtServ!=0)
            denv = modPqtServ;
        else
            numPqtServEnv += 99;
          }
    }

//SI HAY PAQUETE PERDIDO SE ESPERA A QUE VENZA EL TIMER PARA REENVIARLO
    if (pqtPerdido==1)
    {
      for(;pqtPerdido==1;)
      {
      if (timeout==0)//REENVÍO DEL PAQUETE
      {
        if (envAck < 2 && denv !=0 )
        {
        this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
        reconocido=0;
        pqtPerdido=0;
        envAck++;
        }  
        else if (denv !=0) //FLECHAS CRUZADAS
        {
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
        envAck++;
        reconocido=0;
        pqtPerdido=0;
        }
      }
      else
      {
        timeout--;
        if (timeout==0)
        {
          umbral = Math.floor(this.cli.vcrep/2);
          if (umbral==0)umbral=1;
          this.serv.vcrep=1;
          this.serv.vc=1;
          this.serv.ec = false;
          this.serv.flags = nullflag;
          this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: al, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbral, envio:1});
          
        }
        else
          this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbral, envio:0});
      }
      }
    }
    // ACK FINAL
    if (envAck != 0 || (envAck == 0 && numPqtServEnv == 1)) { // Si el ACK no se ha enviado ya
      if (envAck != 0){
        this.cli.ult_an = this.cli.an;
        this.cli.an = this.serv.ult_sn + denv;
      }
      this.cli.ult_sn = this.cli.sn;
      this.incrementarVC(this.serv, this.cli, mssServ);
      this.comprobarEC(this.serv, umbral);
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: ack, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
      this.serv.ult_sn = this.serv.sn;
      this.serv.ult_an = this.serv.an;
      this.cli.ult_an = this.cli.an;
    }

    
    // El cliente espera 1 tick por si hay intercambio de informacion y luego se procede a cerrar
    if (envAck == 2 && cierre == "1")
    { 
      this.comunicacion.push({ numseg: null, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
    }

    // ----- Cierre -----
    // Enviamos los segmentos de FIN; FIN, ACK; y ACK
    if (cierre == "1") { // El cliente cierra la conexion
      //FIN
      this.cli.ult_sn = this.cli.sn;
      this.cli.flags = fin;
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });
      // FIN, ACK
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += denv;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + 1;
      this.serv.flags = finack;
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0 ,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0});
      // ACK
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn++;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + 1;
      this.cli.flags = ack;
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:0 });

    } else { // El servidor cierra la conexion
      // FIN
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += denv;
      this.serv.ult_an = this.serv.an;
      this.serv.flags = fin;
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1});
      // FIN, ACK
      this.cli.ult_sn = this.cli.sn;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + 1;
      this.cli.flags = finack;
      this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbral, envio:1 });
      // ACK
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn++;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + 1;
      this.serv.flags = ack;
      this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0 ,umbral:umbral, envio:1});
    }

    return;
  }

  /**

   * @description Compara la ventana de recepción del servidor con el MSS del cliente
   * @author Alberto-Malagon
   * @returns
   */
  comprobarACKretardado_serv(): boolean {
    if (this.serv.w == this.simular.mssclien )
    return true;
    else
    return false;
  }
  /**
  * @description Compara la ventana de recepción del cliente con el MSS del servidor
  * @author Alberto-Malagon
  * @returns
  */
 comprobarACKretardado_cli(): boolean {
   if (this.cli.w == this.simular.mssserv )
   return true;
   else
   return false;
 }
}
