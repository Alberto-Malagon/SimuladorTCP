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
import { THIS_EXPR } from '@angular/compiler/src/output/output_ast';

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
  Num_ACKdup: number; // Indica el numero de ACKs duplicados enviados
  NumEnvio: number; // Hace referencia al numero de envio del que se trata
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
  rr: Boolean; // control de activacion del flag RR
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
      this.cli = { sn: 0, ult_sn: 0, an: 0, ult_an: 0, data: 0, w: 0, segperd: "", vc: 0, vcrep: 0, flags: [], ec: false, rr: false };
      this.serv = { sn: 0, ult_sn: 0, an: 0, ult_an: 0, data: 0, w: 0, segperd: "", vc: 0, vcrep: 0, flags: [], ec: false, rr: false};
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
    if (maqVC.ec == false && maqVC.rr == false) { // EC desactivado
      maqVC.vc += Math.ceil((maqACK.an - maqACK.ult_an) / mss);
      maqVC.vcrep = maqVC.vc;
    }
    else if (maqVC.ec == true && maqVC.rr == false){
      let tramas: number = Math.ceil((maqACK.an - maqACK.ult_an) / mss);

      for (let i = 1; i <= tramas; i++) {
        maqVC.vc = maqVC.vc + 1 / Math.floor(maqVC.vc);
      }
      maqVC.vcrep = Math.round((maqVC.vc + Number.EPSILON) * 100) / 100;
    }
    else if (maqVC.rr == true )
    {
      maqVC.vcrep = maqVC.vc;
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
    let ec: string[] = ["", "", "", "", "EC", "",""];
    let ecal: string[] = ["", "", "", "AL", "EC", "",""];
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
    let umbralcli: number = this.simular.umbral;
    let umbralserv: number = this.simular.umbral;
    let algort: string = this.simular.algort;
    let cierre: string = this.simular.cierre;
    /*-----VARIABLES-----*/
    // General
    let mss: number = Math.min(this.simular.mssclien, this.simular.mssserv); // Se elige el minimo MSS
    let nseg: number = 0;
    let denv: number = mss; // Datos a enviar
    let pasoapaso: number = this.simular.pasoapaso;
    let NumEnvios: number = this.simular.envios;
    // Cliente
    let mssClien: number = Math.min(mss, this.serv.w);
    let numPqtClien: number = Math.floor(this.cli.data / mssClien);
    let numPqtClienEnv: number = 0; //Indica los pqt enviados (para saber cuando terminar)
    var segperdNumclien = this.simular.segperdclien.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico
    let contadorPqtEnv: number =0;  //Indica los pqt enviados (para comparar con los segmentos perdidos)
    let modPqtClien: number = this.cli.data % mssClien;
    let envMaxClien: number = Math.floor(this.serv.w / mssClien);
    //Servidor
    let mssServ: number = Math.min(mss, this.cli.w);
    let numPqtServ: number = Math.floor(this.serv.data / mssServ);
    let numPqtServEnv: number = 0;
    var segperdNumserv = this.simular.segperdserv.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico
    let modPqtServ: number = this.serv.data % mssServ;
    let envMaxServ: number = Math.floor(this.cli.w / mssServ);

    //Variables auxiliares
    let pqtPerdido: number =0; //0 Si no hay pqt perdido o se ha retransmitido  1 Si hay paquete perdido sin retransmitir
    let envAck: number = 0; // Cada dos paquetes enviados por el cliente, el servidor devuelve un ACK
    let x: number=0;
    let y: number=0;
    let reconocido: number = 0; //1--> El segmento perdido no ha sido reconocido  0--> El segmento perdido ha sido reconocido
    let sn_perd: number;
    let an_perd: number;
    let d_perd: number;
    let ultDataEnv: number = denv; // Tamanyo de los ultimos datos enviados
    let ACK_inm: number = 0;
    let flag_ACKdup: number = 0;
    let ACK_dup: number = 0;
    let sin_ACK: number = 0;
    let ACK_aux:number=0;
    
    // ----- Conexion -----
    // Enviamos los segmentos de SYN; SYN, ACK; y ACK
    if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: 0, dcli: 0, wcli: this.cli.w, msscli: this.simular.mssclien, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0 });
    this.serv.ult_an = this.serv.an;
    this.serv.an = this.cli.sn + 1;
    if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: this.simular.mssserv, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0,NumEnvio:0});
    this.serv.flags = nullflag;
    this.cli.ult_sn = this.cli.sn;
    this.cli.sn += 1;
    this.cli.ult_an = this.cli.an;
    this.cli.an = this.serv.sn + 1;
    this.cli.flags = ack;
    if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0 });
    this.cli.flags = nullflag;

// ----------------------------- LADO CLIENTE -----------------------------------------   
 // >>>>> Envio de datos cliente->servidor <<<<<
 // PRIMER ENVÍO
 // ###############
    if (numPqtClien == 0)
      denv = modPqtClien;
    else
      denv = mssClien;

    // >>>>> Si el primer segmento se pierde <<<<<
    if (this.simular.segperdclien != null && contadorPqtEnv+1==segperdNumclien[x])
    {
      x++;
      this.cli.flags=nullflag;
      sn_perd = this.cli.sn;
      an_perd = this.cli.an;
      d_perd = denv;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1 , pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:1});
      contadorPqtEnv++;
      timeout= this.simular.timeout;
      reconocido=1;
      pqtPerdido=1;
      timeout--;
    }
    else    // Si no se pierde, el cliente envía el primer paquete
    {
    if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1 , pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:1});
    numPqtClienEnv++;
    contadorPqtEnv++;
    }
    //SI HAY SEGMENTO PENDIENTE DE REENVÍO SE REENVÍA O SE ESPERA A QUE VENZA EL TIMER
    if (pqtPerdido==1)
    {
      for(;pqtPerdido==1;)
      { 
        if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TIMEOUT
        {
          if (envAck < 2 && denv !=0 )
          {
          this.cli.vcrep+=1;
          this.cli.vc+=1;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc:0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          reconocido=0;
          ACK_inm = 1;
          pqtPerdido=0;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
         }  
        }
        else  //SEGMENTO VACÍO ESPERANDO A QUE CADUQUE EL TIMEOUT
        {
          timeout--;
          if (timeout==0)// ÚLTIMO SEGMENTO VACÍO ANTES DEL REENVÍO
          {
            umbralcli = this.cli.vcrep/2;
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al;
            if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          }
          else
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
      }
    }
    if (numPqtClien != 0 && segperdNumclien[0]!=1) // Si hay mas de un paquete a enviar
    {
      // El servidor espera 1 tick por si recibe otro paquete
      if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
      // El servidor manda el ACK del primer paquete
      this.serv.flags = ack;
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += 1;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + denv;
      this.incrementarVC(this.cli, this.serv, mssClien);
      this.comprobarEC(this.cli, umbralcli);
      // PRIMER ACK
      if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2 , pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
      this.cli.ult_an = this.serv.an;
    }
    //RESTO DE PAQUETES (Segmentos enviados después del primer segmento de datos y su ACK)
    //#########################################################################################
  for (; numPqtClienEnv <= numPqtClien; numPqtClienEnv++) { 
    let x: number=0;
    //REENVÍO PAQUETE PERDIDO
    if ((this.simular.segperdclien != null && timeout==0 && pqtPerdido==1) || (this.simular.segperdclien != null && ACK_dup==3 && pqtPerdido==1))
    {
      if (this.simular.segperdclien != null && timeout==0 && pqtPerdido==1) // POR FIN DEL TIMEOUT
      {
        if (envAck < 2 && denv !=0 ) // SEGMENTO UNIDIRECCIONAL (FIN TIMEOUT)
        {
        this.cli.vcrep+=1;
        this.cli.vc+=1;
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }  
        else if (denv !=0) // SEGMENTO BIDIRECCIONAL (FIN TIMEOUT)
        {
        this.cli.vcrep+=1;
        this.cli.vc+=1;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }
      }
      else // 3 ACK'S DUPLICADOS
      {
        //SEGMENTO BIDIRECCIONAL (ACK DUPLICADO)
        this.cli.vc++;
        this.cli.vcrep=this.cli.vc;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        ACK_dup++;
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: ack, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:0, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
        this.cli.vc++;
        this.cli.vcrep++;
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        
      }
    }
      //ACK INMEDIATO
      else if (ACK_inm==1)
      {
        if (this.cli.vcrep <= sin_ACK)  // SEGMENTO UNIDIRECCIONAL
        {
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
          this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
          this.serv.flags = ack;
          //PASO RR->EC
          if (this.cli.rr==true) 
          {
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.ec==true)
            {
              this.cli.vc=umbralcli;
              this.cli.vcrep=this.cli.vc;
              this.cli.flags=ec;
            }
          }
          else
          {
            this.incrementarVC(this.cli, this.serv, mssClien);
            this.comprobarEC(this.cli, umbralcli);
          }
          this.serv.ult_an = this.serv.an;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:0});
          numPqtClienEnv--; 
          envAck = 0;
          flag_ACKdup = 0;
          ACK_inm=0;
          ACK_dup = 0;
          sin_ACK = 0;
          this.cli.rr = false;
          if (this.cli.ec == true) this.cli.flags = ec;
          else this.cli.flags = al;
        }
        else  // SEGMENTO BIDIRECCIONAL
        {
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
          this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
          this.serv.flags = ack;
          this.cli.sn += ultDataEnv;
          //PASO RR->EC
          if (this.cli.rr==true) 
          {
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.ec==true)
            {
              this.cli.vc=umbralcli;
              this.cli.vcrep=this.cli.vc;
              this.cli.flags=ec;
            }
          }
          else
          {
            this.incrementarVC(this.cli, this.serv, mssClien);
            this.comprobarEC(this.cli, umbralcli);
          }
          this.serv.ult_an = this.serv.an;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:0});
          envAck = 1;
          flag_ACKdup = 0;
          ACK_inm=0;
          ACK_dup = 0;
          sin_ACK = 0;
          this.cli.rr = false;
          if (this.cli.ec == true) this.cli.flags = ec;
          else this.cli.flags = al;
        }
      }
      //ACK
      else if (envAck == Math.min(this.cli.vcrep, envMaxClien) || (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) <=2) || (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) == sin_ACK) ) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
      {
        if (reconocido==0) // ACK NORMAL
        {
          timeout --;
          this.serv.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          let inc: number = this.cli.ult_sn - this.serv.ult_an;
          this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
          this.incrementarVC(this.cli, this.serv, mssClien);
          this.comprobarEC(this.cli, umbralcli);
          if(timeout==0 && pqtPerdido==1) // PAQUETE ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
          {
            umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al;
            if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:0});
          }
          else // ENVÍO NORMAL
          {
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:0});
          }
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          numPqtClienEnv--; 
          envAck = 0;
        }
        else if (reconocido==1) //ACK DUPLICADO
        {
          timeout --;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          let inc: number = this.cli.ult_sn - this.serv.ult_an;
          this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
          this.serv.ult_an = this.serv.an;
          this.serv.flags = ack;
          ACK_dup++;
          if(ACK_dup == 3) // TERCER ACK DUPLICADO --> RR
          {
            this.cli.flags = rr;
            this.cli.rr = true;
            umbralcli = Math.round((this.cli.vc / 2)*100)/100;
            this.cli.vc=umbralcli + 3;
          }
          if(timeout==0 && pqtPerdido==1) // PAQUETE ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
          {
            umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al;
            if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          else //ENVÍO NORMAL
          {
            if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vc, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          numPqtClienEnv--; 
          envAck = 0; 
          flag_ACKdup = 0;
        }
      }
      //SEGMENTOS PERDIDOS
      else if (this.simular.segperdclien!= null && contadorPqtEnv+1==segperdNumclien[x])
      {
        x++;
        sin_ACK++;
        this.cli.flags=nullflag;
        if (envAck < 2 && denv !=0) //SEGMENTO UNIDIRECCIONAL (SEGMENTOS PERDIDO)
        {
        this.serv.flags= nullflag;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.serv.flags= nullflag;
        this.comprobarEC(this.cli, umbralcli);
        sn_perd = this.cli.sn;
        an_perd = this.cli.an;
        d_perd = denv;
        this.serv.an += ultDataEnv;
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        ultDataEnv = denv;
        contadorPqtEnv++;
        numPqtClienEnv--;
        timeout=this.simular.timeout;
        reconocido=1;
        pqtPerdido=1;
        timeout--;
        envAck++;
        }
        else if (denv !=0) // SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
        {
        this.serv.flags = ack;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
        this.incrementarVC(this.cli, this.serv, mssClien);
        this.comprobarEC(this.cli, umbralcli);
        sn_perd = this.cli.sn;
        an_perd = this.cli.an;
        d_perd = denv;
        this.serv.an += ultDataEnv;
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:0});
        contadorPqtEnv++;
        numPqtClienEnv--;
        envAck = 1;
        timeout=this.simular.timeout;
        reconocido=1;
        pqtPerdido=1;
        timeout--;
        ACK_aux=1;
      }
      }
      //SEGMENTO DE DATOS
      else if (envAck < 2 && denv !=0 && sin_ACK < Math.floor(this.cli.vc) && flag_ACKdup == 0 ) // El numero de paquetes enviados no alcanza al ACK
      {
        timeout --;
        this.serv.flags= nullflag;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.comprobarEC(this.cli, umbralcli);
        if(timeout==0 && pqtPerdido==1) // PAQUETE ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
        { 
          umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
          if (umbralcli==0)umbralcli=1;
          this.cli.vcrep=1;
          this.cli.vc=1;
          this.comprobarEC(this.cli, umbralcli);
          if (this.cli.flags==ec) this.cli.flags=ecal;
          else this.cli.flags = al;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
        else // ENVÍO NORMAL
        {
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 , emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          if(pqtPerdido==1) 
          {
            flag_ACKdup=1;
            sin_ACK++;
          }
        }
        this.cli.ult_sn = this.cli.sn;
        ultDataEnv = denv;
        envAck++;
        contadorPqtEnv++;      
      }
      //SEGMENTO VACÍO (Esperando que caduque el temporizador)
      else if (sin_ACK >= Math.floor(this.cli.vc))
      {
        timeout--;
        numPqtClienEnv--;
        if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
        { 
          umbralcli = this.cli.vcrep/2; 
          if (umbralcli==0)umbralcli=1;
          this.cli.vcrep=1;
          this.cli.vc=1;
          this.cli.ec = false;
          this.comprobarEC(this.cli, umbralcli);
          if (this.cli.flags==ec) this.cli.flags=ecal;
          else this.cli.flags = al;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
        else //SEGMENTO VACÍO
        {
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
      }
      //ACK Y DATOS (SEGMENTO BIDIRECCIONAL)
      else if (denv !=0 || (flag_ACKdup == 1 && this.cli.vcrep >2)){ // Cada 2 paquetes enviados por el cliente, el servidor envia un ACK mientras el cliente envía datos (flechas cruzadas)
        if (reconocido==0) // ACK NORMAL Y DATOS
        {  
          timeout--;
          this.serv.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.sn += ultDataEnv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
          this.incrementarVC(this.cli, this.serv, mssServ);
          this.comprobarEC(this.cli, umbralcli);
          if(timeout==0 && pqtPerdido==1) // SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
          { 
            umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al;
            if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          }
          else // ENVÍO NORMAL
          {
            if ( nseg+1<=pasoapaso|| pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          }
          ultDataEnv = denv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          envAck = 1;
          contadorPqtEnv++;
        }
        else if (reconocido==1) //ACK DUPLICADO Y DATOS
        {
          timeout--;
          this.serv.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.sn += ultDataEnv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
          sin_ACK++;
          if (ACK_aux==0) ACK_dup = 0;
          else ACK_dup++;
          if(ACK_dup == 3) // TERCER ACK DUPLICADO --> RR
          {
            this.cli.flags = rr;
            this.cli.rr = true;
            umbralcli = Math.round((this.cli.vc / 2)*100)/100;
            this.cli.vc=umbralcli + 3;
          }
          if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
          { 
            umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al; 
            if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          else //ENVÍO NORMAL
          {
            if (nseg+1<=pasoapaso|| pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vc, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          ultDataEnv = denv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          envAck = 1;// Con el ACK se envía otro paquete , por lo que hay un paquete sin reconocer => envAck=1
          contadorPqtEnv++;
          flag_ACKdup=1;
          ACK_aux =1;
        }

      }
      //COMPROBACIÓN ERROR MÁS SEGMENTOS DE LO NORMAL: 
      //Si estamos en el antepenúlitmo paquete a enviar y hay segmento perdido salimos del bucle Y reenviamos fuera
      if (numPqtClienEnv == numPqtClien -2) 
      {
        if (pqtPerdido==1)
        {
          numPqtClienEnv += 99;
        }
      }
      //COMPROBACIÓN ERROR SEGMENTO VACÍO:
      //Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
      if (numPqtClienEnv == numPqtClien - 1){ 
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
      if (ACK_dup==3)// REENVÍO POR 3 ACKs DUPLICADOS
      {
        umbralcli = Math.round ((this.cli.vc / 2)*100)/100;
        this.cli.vc=umbralcli + 3;
        this.cli.vcrep=this.cli.vc;
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        this.cli.vc++;
        this.cli.vcrep++;
        envAck++;
        this.cli.vcrep = umbralcli;
        this.cli.vc = umbralcli;
        this.cli.flags = ec;
        reconocido=0;
        sin_ACK=0;
        ACK_dup=0;
        pqtPerdido=0;
      }
      else if (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) >= sin_ACK) // ACK DUPLICADO
      {
        timeout --;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        let inc: number = this.cli.ult_sn - this.serv.ult_an;
        this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
        this.serv.ult_an = this.serv.an;
        this.serv.flags = ack;
        ACK_dup++;
        if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
        {
          this.cli.flags = rr;
          this.cli.rr = true;
          umbralcli = Math.round((this.cli.vc / 2)*100)/100;
          this.cli.vc=umbralcli + 3;
        }
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
        envAck = 0; 
        flag_ACKdup = 0;
      }
      else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TIMEOUT
      {
        if (envAck < 2 && denv !=0 ) // SEGMENTO UNIDIRECCIONAL
        {
        this.comprobarEC(this.cli, umbralcli);
        if (this.cli.flags==ec) this.cli.flags=ecal;
        else this.cli.flags = al;
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        reconocido=0;
        ACK_inm = 0;
        pqtPerdido=0;
        }  
        else if (denv !=0) //SEGMENTO BIDIRECCIONAL
        {
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }
      }
      else //SEGMENTO VACÍO (Esperando que caduque el temporizador)
      {
        timeout--;
        if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO
        {
          umbralcli = this.cli.vcrep/2;
          if (umbralcli==0)umbralcli=1;
          this.cli.vcrep=1;
          this.cli.vc=1;
          this.comprobarEC(this.cli, umbralcli);
          if (this.cli.flags==ec) this.cli.flags=ecal;
          else this.cli.flags = al;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          
        }
        else //SEGMENTO VACÍO
        {
          if (nseg+1<=pasoapaso|| pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
        }
      }
    }
  
    // ----------------------------- LADO SERVIDOR -----------------------------------------
    // >>>>> Envio de datos servidor->cliente <<<<<
    sin_ACK=0;
    contadorPqtEnv=0;
    numPqtServEnv=0;
    ACK_aux=0;
    
    //SE COMPRUEBA SI EL PRIMER ENVÍO JUNTO AL ACK SE ENVÍA INMEDIATAMENTE O SE ESPERA UN TIC
    if (envAck==1)
    {
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:0, envio:0, Num_ACKdup:0, NumEnvio:0});
      envAck=0;
    }
    else envAck=0;
    // PRIMER PAQUETE DATOS + ACK
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
      this.comprobarEC(this.cli, umbralserv);
    }
      //PRIMER PAQUETE PERDIDO
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
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
          contadorPqtEnv++;
          reconocido = 1;
          pqtPerdido = 1;
          timeout--;
        }
        else if (pqtPerdido != 1)//ENVÍO PRIMER PAQUETE 
        {
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an++;
          this.serv.ult_an = this.serv.an;
          this.cli.flags = nullflag;
          contadorPqtEnv++;
          numPqtServEnv++;
          ACK_inm=0;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
        }
        if (pqtPerdido == 1 && timeout != 0) //SEGMENTO VACÍO (Esperando que caduque el temporizador)
        {
          timeout--;
          if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            this.serv.vcrep=1;
            this.serv.vc=1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          }
          else
          {
             if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          }
        }
        if (pqtPerdido == 1 && timeout ==0) //REENVÍO PRIMER PAQUETE SERVIDOR --> CLIENTE
        {
          this.serv.flags=nullflag;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: ack, snserv: sn_perd, anserv: an_perd, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
          contadorPqtEnv++;
          numPqtServEnv++;
          pqtPerdido=0;
          // El cliente espera 1 tick por si recibe otro paquete
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
        }
      }
    if (numPqtServ != 0 && pqtPerdido !=1) // PRIMER ACK 
    {
      // El cliente manda el ACK del primer paquete
      this.cli.flags = ack;
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn = this.serv.ult_an;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + denv;
      this.incrementarVC(this.serv, this.cli, mssServ);
      this.comprobarEC(this.serv, umbralserv);
      if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
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
  
    ultDataEnv = denv; 
    envAck = 0;

  //RESTO DE PAQUETES (Segmentos enviados después del primer segmento de datos y su ACK)
  //#########################################################################################
  for (; numPqtServEnv <= numPqtServ; numPqtServEnv++) {
      //REENVÍO PAQUETE PERDIDO
    if ((this.simular.segperdserv != null && timeout==0 && pqtPerdido==1 )|| (this.simular.segperdserv != null && ACK_dup==3 && pqtPerdido==1))
    {
        if (this.simular.segperdserv != null && timeout==0 && pqtPerdido==1 ) // FIN TIMEOUT
        {
        if (envAck < 2) //SEGMENTO UNIDIRECCIONAL
        {
          this.serv.vcrep+=1;
          this.serv.vc+=1;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
        else            //SEGMENTO BIDIRECCIONAL
        {
          this.serv.vcrep+=1;
          this.serv.vc+=1;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
      }
      else // 3 ACK'S DUPLICADOS (SEGMENTO BIDIRECCIONAL)
      {    
          this.serv.ec=false;
          this.serv.vc++;
          this.serv.vcrep= this.serv.vc;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          ACK_dup++;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: ack, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:1, fin_temp:0,umbral:0, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
          this.serv.vc++;
          this.serv.vcrep++;
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
      }
    }
      //ACK INMEDIATO
      else if (ACK_inm==1)
      {
        if (this.serv.vcrep <= sin_ACK) //SEGMENTO UNIDIRECCIONAL
        {
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = Math.abs(this.serv.ult_sn - this.cli.ult_an);
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          //PASO RR->EC
          if (this.serv.rr==true)
          {
           this.comprobarEC(this.serv, umbralserv);
           if (this.serv.ec==true)
           {
             this.serv.vc=umbralserv;
             this.serv.vcrep=this.serv.vc;
           }
          }
          else
          {
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbralserv);
          }
          this.cli.ult_an = this.cli.an;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
          numPqtServEnv--;
          envAck = 0;
          ACK_inm = 0;
          ACK_dup = 0;
          sin_ACK = 0;
          flag_ACKdup = 0;
          this.serv.rr = false;
          if (this.serv.ec == true) this.serv.flags = ec;
          else this.serv.flags = al;
        }
        else //SEGMENTO BIDIRECCIONAL
        {
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = Math.abs(this.serv.ult_sn - this.cli.ult_an);
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          this.serv.sn += ultDataEnv;
          //PASO RR->EC
          if (this.serv.rr==true)
          {
           this.comprobarEC(this.serv, umbralserv);
           if (this.serv.ec==true)
           {
             this.serv.vc=umbralserv;
             this.serv.vcrep=this.serv.vc;
           }
          }
          else
          {
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbralserv);
          }
          this.cli.ult_an = this.cli.an;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
          envAck = 1;
          ACK_inm = 0;
          ACK_dup = 0;
          sin_ACK = 0;
          flag_ACKdup = 0;
          this.serv.rr = false;
          if (this.serv.ec == true) this.serv.flags = ec;
          else this.serv.flags = al;
        }
      }
      //ACK
      else if (envAck == Math.min(this.serv.vcrep, envMaxServ)||(flag_ACKdup==1 && this.serv.vcrep <=2) || (flag_ACKdup==1 && Math.floor(this.serv.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
      {
        if (reconocido==0) //ACK NORMAL
        {
          timeout--;
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = this.serv.ult_sn - this.cli.ult_an;
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbralserv);
          if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
          {
            umbralserv = this.serv.vcrep/2;
            if (umbralserv==0)umbralserv=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          }
          else //ENVÍO NORMAL
          {
            if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          }
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          numPqtServEnv--;
          envAck = 0;
        }
        else if (reconocido==1) //ACK DUPLICADO
        {
          timeout--;
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = this.serv.ult_sn - this.cli.ult_an;
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          this.cli.ult_an = this.cli.an;
          ACK_dup++;
          if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
          {
            this.serv.flags = rr;
            this.serv.rr = true;
            umbralserv = Math.round((this.serv.vc/2)*100)/100;
            this.serv.vc=umbralserv+3;
          }
          if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralserv = Math.round((this.serv.vcrep/2)*100)/100;
            if (umbralserv==0)umbralserv=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0 });
          }
          else 
          {
            if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vc, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
          }
          numPqtServEnv--;
          envAck = 0;
          flag_ACKdup=0;
        }
      }
      //SEGMENTOS PERDIDOS
      // Segmento perdido dirección servidor --> cliente
      else if (this.simular.segperdserv!= null && contadorPqtEnv==segperdNumserv[y])
      {
        y++;
        sin_ACK++;
        this.serv.flags=nullflag;
        if (envAck < 2) //SEGMENTO UNIDIRECCIONAL (Segmento perdido)
        {
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.comprobarEC(this.serv, umbralserv);
          sn_perd = this.serv.sn;
          an_perd = this.serv.an;
          d_perd = denv;
          this.cli.an += ultDataEnv;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          this.serv.ult_sn = this.serv.sn;
          ultDataEnv = denv;
          contadorPqtEnv++;
          numPqtServEnv--;
          timeout = this.simular.timeout;
          reconocido = 1;
          pqtPerdido = 1;
          timeout--;
          envAck++;
        }
        else //SEGMENTO BIDIRECCIONAL (Segmento perdido)
        {
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbralserv);
          sn_perd = this.serv.sn;
          an_perd = this.serv.an;
          d_perd = denv;
          this.cli.an += ultDataEnv;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -20, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          contadorPqtEnv++;
          numPqtServEnv--;
          timeout = this.simular.timeout;
          reconocido = 1;
          pqtPerdido = 1;
          envAck = 1; 
          timeout--;
          ACK_aux=1;
        }
      }
      // SEGMENTO DE DATOS
      else if (envAck < 2 && sin_ACK < Math.floor(this.serv.vc) && flag_ACKdup==0) // El numero de paquetes enviados no alcanza al ACK
      {
        timeout--;
        this.cli.flags = nullflag;
        this.serv.ult_sn = this.serv.sn;
        this.serv.sn += ultDataEnv;
        this.comprobarEC(this.serv, umbralserv);
        if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
        {
          umbralserv = this.cli.vcrep/2;
          if (umbralserv==0)umbralserv=1;
          this.serv.vcrep = 1;
          this.serv.vc = 1;
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true) this.serv.flags=ecal;
          else this.serv.flags = al;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
        }
        else
        {
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
        if(pqtPerdido==1) // Si hay paquete perdido aumentamos en una unidad el número de segmentos sin reconocer y activamos el flag de ACK duplicado para el siguiente paquete
        {
        sin_ACK++;
        flag_ACKdup=1;
        }
      }
        this.serv.ult_sn = this.serv.sn;
        ultDataEnv = denv;
        envAck++;
        contadorPqtEnv++;
      }
      //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
      else if (sin_ACK >= Math.floor(this.serv.vc))
      {
        timeout--;
        numPqtServEnv--;
        if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
        { 
          umbralserv = this.serv.vcrep/2; 
          if (umbralserv==0)umbralserv=1;
          this.serv.vcrep=1;
          this.serv.vc=1;
          this.serv.ec = false;
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true) this.serv.flags=ecal;
          else this.serv.flags = al;
          if (nseg+1<=pasoapaso|| pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
        }
        else
        {
          if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
      }
      //ACK Y DATOS (SEGMENTO BIDIRECCIONAL)
      else if (denv!=0 || (flag_ACKdup==1 && this.serv.vcrep>2))  { // Cada 2 paquetes enviados por el servidor, el cliente envía ack y el servidor envía datos (flechas cruzadas)
        if (reconocido==0) //ACK NORMAL + DATOS
        {
          timeout--;
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbralserv);
          if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralserv = this.serv.vcrep/2;
            if (umbralserv==0)umbralserv=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          }
          else // ENVÍO NORMAL
          {
            if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
          }
            ultDataEnv = denv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          envAck = 1;
          contadorPqtEnv++;
        }
        else if (reconocido == 1) //ACK DUPLICADO + DATOS
        {
          timeout --;
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          sin_ACK++;
          if (ACK_aux==0) ACK_dup = 0;
          else ACK_dup++;
          if(ACK_dup == 3) // TERCER ACK DUPLICADO --> RR
          {
            this.serv.flags = rr;
            this.serv.rr = true;
            umbralserv = Math.round((this.serv.vc/2)*100)/100;
            this.serv.vc=umbralserv+3;
          }
          if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
          {
            umbralserv = this.serv.vcrep/2;
            if (umbralserv==0)umbralserv=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0 });
          }
          else
          {
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vc,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          ultDataEnv = denv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          contadorPqtEnv++;
          flag_ACKdup=1;
          ACK_aux =1;
        }
      }
      //COMPROBACIÓN ERROR SEGMENTOS DE MÁS:
      // Si es el penultimo paquete a enviar, sin contar el que se debe reenviar,se prepara para enviar los datos restantes en el último
      if (numPqtServEnv == numPqtServ - 2){ 
        if (pqtPerdido == 1)
            numPqtServEnv += 99;  
       }
      //COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
      // Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
      if (numPqtServEnv == numPqtServ - 1){ 
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
        if (ACK_dup==3)//REENVÍO POR 3 ACKs DUPLICADOS
        {
          this.serv.ec = false;
          umbralserv = Math.round((this.serv.vc/2)*100)/100;
          this.serv.vc=umbralserv+3;
          this.serv.vcrep= this.serv.vc;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
          this.serv.vc++;
          this.serv.vcrep++;
          envAck++;
          this.serv.vcrep = umbralserv;
          this.serv.vc = umbralserv;
          this.serv.flags = ec;
          reconocido = 0;
          ACK_dup=0;
          sin_ACK=0;
          pqtPerdido = 0;
        }
      else if  (flag_ACKdup==1 && Math.floor(this.serv.vcrep) >= sin_ACK) //ACK DUPLICADO
      {
        timeout--;
        this.cli.flags = ack;
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        let inc: number = this.serv.ult_sn - this.cli.ult_an;
        this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
        this.cli.ult_an = this.cli.an;
        ACK_dup++;
        if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR 
        {
          this.serv.flags = rr;
          this.serv.rr = true;
          umbralserv = Math.round((this.serv.vc/2)*100)/100;
          this.serv.vc=umbralserv+3;
        }
        if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
        envAck = 0;
        flag_ACKdup=0;
      }  
      else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TIMEOUT
      {
        if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
        {
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
        reconocido=0;
        pqtPerdido=0;
        envAck++;
        sin_ACK=0;
        ACK_inm=1;
        }  
        else if (denv !=0) //SEGMENTO BIDIRECCIONAL
        {
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
        envAck++;
        reconocido=0;
        pqtPerdido=0;
        sin_ACK=0;
        ACK_inm=1;
        }
      }
      else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
      {
        timeout--;
        if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
        {
          umbralserv = this.cli.vcrep/2;
          if (umbralserv==0)umbralserv=1;
          this.serv.vcrep=1;
          this.serv.vc=1;
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true) this.serv.flags=ecal;
          else this.serv.flags = al;
          this.comprobarEC(this.serv, umbralserv);
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
        }
        else
        {
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
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
      this.comprobarEC(this.serv, umbralserv);
      if (NumEnvios==1)// Si solo hay 1 envío, se envía el ACK final
      {
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: ack, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
      }
      this.serv.ult_sn = this.serv.sn;
      this.serv.ult_an = this.serv.an;
      this.cli.ult_an = this.cli.an;
    }

    // ############### SEGUNDO ENVÍO #####################
if (NumEnvios == 2 || NumEnvios == 3)
{
      //ACTUALIZACIÓN DE VARIABLES
      /*-----VARIABLES-----*/
      contadorPqtEnv = 0;  
      timeout = this.simular.timeout;
      x=0;
      y=0;
      ACK_aux =0;
      // Cliente
      this.cli.data = this.simular.datosclien2;
      this.cli.segperd = this.simular.segperdclien2;
      var segperdNumclien2 = this.simular.segperdclien2.split(',').map(Number); 
      let numPqtClien: number = Math.floor(this.cli.data / mssClien);
      let numPqtClienEnv: number = 0; 
      let modPqtClien: number = this.cli.data % mssClien;
      let envMaxClien: number = Math.floor(this.serv.w / mssClien);
      //Servidor
      this.serv.data = this.simular.datosserv2;
      this.serv.segperd = this.simular.segperdserv2;
      var segperdNumserv2 = this.simular.segperdserv2.split(',').map(Number); 
      let numPqtServ: number = Math.floor(this.serv.data / mssServ);
      let numPqtServEnv: number = 0;
      let modPqtServ: number = this.serv.data % mssServ;
      let envMaxServ: number = Math.floor(this.cli.w / mssServ);

 // ----------------------------- LADO CLIENTE -----------------------------------------   
 // >>>>> Envio de datos cliente->servidor <<<<<
 if (numPqtClien == 0)
 denv = modPqtClien;
else
 denv = mssClien;

//ENVÍO DE PAQUETES
//############################
numPqtClienEnv++;
if (envAck<2 && ACK_inm==0) envAck=0;
else 
{
  envAck=0;
  ACK_inm=0;
}

for (; numPqtClienEnv <= numPqtClien+1; numPqtClienEnv++) { 
let x: number=0;
let numenvio: number=0;
if (numPqtClienEnv==1)numenvio=2;
else numenvio=0;

//REENVÍO PAQUETE PERDIDO
if ((this.simular.segperdclien2 != null && timeout==0 && pqtPerdido==1) || (this.simular.segperdclien2 != null && ACK_dup==3 && pqtPerdido==1))
{
 if (this.simular.segperdclien2 != null && timeout==0 && pqtPerdido==1) //REENVÍO POR FIN DEL TIMEOUT
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   this.cli.vcrep+=1;
   this.cli.vc+=1;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:numenvio, Num_ACKdup:0, NumEnvio:0});
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.cli.vcrep+=1;
   this.cli.vc+=1;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }
 }
 else // 3 ACK'S DUPLICADOS
 {
   if (denv !=0) //SEGMENTO BIDIRECCIONAL (ACK DUPLICADO + DATOS REENVIADOS)
   {
   this.cli.vc=this.cli.vc + 1;
   this.cli.vcrep=this.cli.vc;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   ACK_dup++;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: ack, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:0, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
   this.cli.vc++;
   this.cli.vcrep++;
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }
 }
}
 //ACK INMEDIATO
 else if (ACK_inm==1) //SEGMENTO UNIDIRECCIONAL (ACK)
 {
   if (this.cli.vcrep <= sin_ACK)
   {
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
     this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
     this.serv.flags = ack;
     //PASO RR->EC
     if (this.serv.rr==true)
      {
        this.comprobarEC(this.serv, umbralserv);
        if (this.serv.ec==true)
        {
          this.serv.vc=umbralserv;
          this.serv.vcrep=this.serv.vc;
        }
      }
     else
      {
        this.incrementarVC(this.serv, this.cli, mssServ);
        this.comprobarEC(this.serv, umbralserv);
      }
     this.serv.ult_an = this.serv.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
     numPqtClienEnv--; 
     envAck = 0;
     flag_ACKdup = 0;
     ACK_inm=0;
     ACK_dup = 0;
     sin_ACK = 0;
     this.cli.rr = false;
     if (this.cli.ec == true) this.cli.flags = ec;
     else this.cli.flags = al;
   }
   else //SEGMENTO BIDIRECCIONAL (ACK DUPLICADO + DATOS REENVIADOS)
   {
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
     this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
     this.serv.flags = ack;
     this.cli.sn += ultDataEnv;
     //PASO RR->EC
     if (this.cli.rr==true)
     {
      this.comprobarEC(this.cli, umbralcli);
      if (this.cli.ec==true)
      {
        this.cli.vc=umbralcli;
        this.cli.vcrep=this.cli.vc;
        this.cli.flags=ec;
      }
     }
     else
     {
     this.incrementarVC(this.cli, this.serv, mssClien);
     this.comprobarEC(this.cli, umbralcli);
     }
     this.serv.ult_an = this.serv.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
     envAck = 1;
     flag_ACKdup = 0;
     ACK_inm=0;
     ACK_dup = 0;
     sin_ACK = 0;
     this.cli.rr = false;
     if (this.cli.ec == true) this.cli.flags = ec;
     else this.cli.flags = al;
   }
 }
 //ACK
 else if (envAck == Math.min(this.cli.vcrep, envMaxClien) || (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) <=2) || (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) == sin_ACK) ) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
 {
   if (reconocido==0) //ACK NORMAL
   {
     timeout --;
     this.serv.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     let inc: number = this.cli.ult_sn - this.serv.ult_an;
     this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
     this.incrementarVC(this.cli, this.serv, mssClien);
     this.comprobarEC(this.cli, umbralcli);
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVIO POR FIN DEL TEMPORIZADOR
     {
       umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
     }
     else
     {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
     }
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     numPqtClienEnv--; 
     envAck = 0;
   }
   else if (reconocido==1) //ACK DUPLICADO
   {
     timeout --;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     let inc: number = this.cli.ult_sn - this.serv.ult_an;
     this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
     this.serv.ult_an = this.serv.an;
     this.serv.flags = ack;
     ACK_dup++;
     if(ACK_dup == 3)  //TERCER ACK DUPLICADO --> RR
     {
       this.cli.flags = rr;
       this.cli.rr = true;
       umbralcli = Math.round((this.cli.vc / 2)*100)/100;
       this.cli.vc=umbralcli + 3;
     }
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vc, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     numPqtClienEnv--; 
     envAck = 0; 
     flag_ACKdup = 0;
   }
 }
 //SEGMENTOS PERDIDOS
 else if (this.simular.segperdclien2!= null && contadorPqtEnv+1==segperdNumclien2[x])
 {
   x++;
   sin_ACK++;
   this.cli.flags=nullflag;
   // Caso segmento perdido en la dirección cliente -> servidor
   if (envAck < 2 && denv !=0) // SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
   {
   this.serv.flags= nullflag;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.serv.flags= nullflag;
   this.comprobarEC(this.cli, umbralcli);
   sn_perd = this.cli.sn;
   an_perd = this.cli.an;
   d_perd = denv;
   this.serv.an += ultDataEnv;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   ultDataEnv = denv;
   contadorPqtEnv++;
   numPqtClienEnv--;
   timeout=this.simular.timeout;
   reconocido=1;
   pqtPerdido=1;
   timeout--;
   envAck++;
   }
   else if (denv !=0) // SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
   {
   this.serv.flags = ack;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
   this.incrementarVC(this.cli, this.serv, mssClien);
   this.comprobarEC(this.cli, umbralcli);
   sn_perd = this.cli.sn;
   an_perd = this.cli.an;
   d_perd = denv;
   this.serv.an += ultDataEnv;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
   contadorPqtEnv++;
   numPqtClienEnv--;
   envAck = 1;
   timeout=this.simular.timeout;
   reconocido=1;
   pqtPerdido=1;
   timeout--;
   ACK_aux=1;
 }
 }
 //PAQUETES DE DATOS
 else if (envAck < 2 && denv !=0 && sin_ACK < Math.floor(this.cli.vc) && flag_ACKdup == 0 ) // El numero de paquetes enviados no alcanza al ACK
 {
   let vc_aux: number = 0;
   timeout --;
   this.serv.flags= nullflag;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.comprobarEC(this.cli, umbralcli);
   if (numPqtClienEnv==1)
   {
     this.cli.flags=ack;
     vc_aux=this.cli.vcrep;
   }
   if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
   { 
     umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 , emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     if(pqtPerdido==1) 
     {
       flag_ACKdup=1;
       sin_ACK++;
     }
   }
   this.cli.ult_sn = this.cli.sn;
   ultDataEnv = denv;
   envAck++;
   contadorPqtEnv++;      
 }
 //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 else if (sin_ACK >= Math.floor(this.cli.vc))
 {
   timeout--;
   numPqtClienEnv--;
   if(timeout==0 && pqtPerdido==1) // SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
   { 
     umbralcli = this.cli.vcrep/2; 
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
 }
 //ACK Y DATOS 
 else if (denv !=0 || (flag_ACKdup == 1 && this.cli.vcrep >2)){ // Cada 2 paquetes enviados por el cliente, el servidor envia un ACK mientras el cliente envía datos (SEGMENTO BIDIRECCIONAL)
   if (reconocido==0) // ACK NORMAL + DATOS
   {  
     timeout--;
     this.serv.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.sn += ultDataEnv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
     this.incrementarVC(this.cli, this.serv, mssServ);
     this.comprobarEC(this.cli, umbralcli);
     if(timeout==0 && pqtPerdido==1) // SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
     { 
       umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     }
       ultDataEnv = denv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     envAck = 1;
     contadorPqtEnv++;
   }
   else if (reconocido==1) //ACK DUPLICADO + DATOS
   {
     timeout--;
     this.serv.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.sn += ultDataEnv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
     sin_ACK++;
     if (ACK_aux==0) ACK_dup = 0;
     else ACK_dup++;
     if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
     {
       this.cli.flags = rr;
       this.cli.rr = true;
       umbralcli = Math.round((this.cli.vc / 2)*100)/100;
       this.cli.vc=umbralcli + 3;
       this.cli.vcrep = this.cli.vc;
     }
     if(timeout==0 && pqtPerdido==1) // SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
     { 
       umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al; 
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     ultDataEnv = denv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     envAck = 1;
     contadorPqtEnv++;
     flag_ACKdup=1;
     ACK_aux =1;
   }
 }

//COMPROBACIÓN ERROR SEGMENTOS DE MÁS:
// Si es el penultimo paquete a enviar, sin contar el que se debe reenviar,se prepara para enviar los datos restantes en el último
 if (numPqtClienEnv == numPqtClien - 1){ 
  if (pqtPerdido == 1)
      numPqtClienEnv += 99;  
 }
//COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
// Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
 if (numPqtClienEnv == numPqtClien ){ 
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
  if (ACK_dup==3) // REENVÍO POR 3 ACKs DUPLICADOS
  {
    umbralcli = Math.round ((this.cli.vc / 2)*100)/100;
    this.cli.vc=umbralcli + 3;
    this.cli.vcrep=this.cli.vc;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
    this.cli.vc++;
    this.cli.vcrep++;
    envAck++;
    reconocido=0;
    this.cli.vcrep = umbralcli;
    this.cli.vc = umbralcli;
    this.cli.flags = ec;
    sin_ACK=0;
    ACK_dup=0;
    pqtPerdido=0;
  }
  else if (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) >= sin_ACK) // ACK DUPLICADO
  {
    timeout --;
    this.serv.ult_sn = this.serv.sn;
    this.serv.ult_an = this.serv.an;
    let inc: number = this.cli.ult_sn - this.serv.ult_an;
    this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
    this.serv.ult_an = this.serv.an;
    this.serv.flags = ack;
    ACK_dup++;
    if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
    {
      this.cli.flags = rr;
      this.cli.rr = true;
      umbralcli = Math.round((this.cli.vc/2)*100)/100;
      this.cli.vc=umbralcli+3;
      this.cli.vcrep = this.cli.vc;
    }
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
    envAck = 0; 
    flag_ACKdup = 0;
  }
 else if (timeout==0) //REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   this.comprobarEC(this.cli, umbralcli);
   if (this.cli.flags==ec) this.cli.flags=ecal;
   else this.cli.flags = al;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   reconocido=0;
   ACK_inm = 1;
   ACK_dup = 0;
   pqtPerdido=0;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }
 }
 else // SEGMENTO VACÍO
 {
   timeout--;
   if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
   {
     umbralcli = this.cli.vcrep/2;
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0}); 
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
   }
 }
}


// ----------------------------- LADO SERVIDOR -----------------------------------------

if (envAck==1 && ACK_inm==0)envAck=0;
else
{
  envAck=0;
  ACK_inm =0;
} 

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
 this.comprobarEC(this.cli, umbralserv);
}
//ACTUALIZACIÓN DE VARIABLES
ACK_aux=0;
ultDataEnv = denv; 
envAck = 0;
sin_ACK =0;
numPqtServEnv=0;
contadorPqtEnv= 1;

//ENVÍO DE PAQUETES
for (; numPqtServEnv <= numPqtServ; numPqtServEnv++) {
//REENVÍO PAQUETE PERDIDO
if ((this.simular.segperdserv2 != null && timeout==0 && pqtPerdido==1 )|| (this.simular.segperdserv2 != null && ACK_dup==3 && pqtPerdido==1))
{
   if (this.simular.segperdserv2 != null && timeout==0 && pqtPerdido==1 ) // FIN TIMEOUT
   {
   if (envAck < 2) //SEGMENTO UNIDIRECCIONAL
   {
     this.serv.vcrep+=1;
     this.serv.vc+=1;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
   }
   else    //SEGMENTO BIDIRECCIONAL
   {
     this.serv.vcrep+=1;
     this.serv.vc+=1;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
   }
 }
 else // 3 ACK'S DUPLICADOS (SEGMENTO BIDIRECCIONAL)
 {
     this.serv.ec=false;
     this.serv.vc=this.serv.vc+1;
     this.serv.vcrep= this.serv.vc;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     ACK_dup++;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: an_perd, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:1, fin_temp:0,umbral:0, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
     this.serv.vc++;
     this.serv.vcrep++;
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
 }
}
 //ACK INMEDIATO
 else if (ACK_inm==1)
 {
   if (this.serv.vcrep <= sin_ACK) //SEGMENTO UNIDIRECCIONAL
   {
     this.cli.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     let inc: number = Math.abs(this.serv.ult_sn - this.cli.ult_an);
     this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
     // PASO DE RR -> EC
     if (this.serv.rr==true)
     {
      this.comprobarEC(this.serv, umbralserv);
      if (this.serv.ec==true)
      {
        this.serv.vc=umbralserv;
        this.serv.vcrep=this.serv.vc;
      }
     }
     else
     {
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     }
     this.cli.ult_an = this.cli.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
     numPqtServEnv--;
     envAck = 0;
     ACK_inm = 0;
     ACK_dup = 0;
     sin_ACK = 0;
     flag_ACKdup = 0;
     this.serv.rr = false;
     if (this.serv.ec == true) this.serv.flags = ec;
     else this.serv.flags = al;
   }
   else // SEGMENTO BIDIRECCIONAL
   {
     this.cli.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     let inc: number = Math.abs(this.serv.ult_sn - this.cli.ult_an);
     this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
     this.serv.sn += ultDataEnv;
     //PASO DE RR --> EC
     if (this.serv.rr==true)
     {
      this.comprobarEC(this.serv, umbralserv);
      if (this.serv.ec==true)
      {
        this.serv.vc=umbralserv;
        this.serv.vcrep=this.serv.vc;
      }
     }
     else
     {
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     }
     this.cli.ult_an = this.cli.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
     envAck = 1;
     ACK_inm = 0;
     ACK_dup = 0;
     sin_ACK = 0;
     flag_ACKdup = 0;
     this.serv.rr = false;
     if (this.serv.ec == true) this.serv.flags = ec;
     else this.serv.flags = al;
   }
 }
 //ACK
 else if (envAck == Math.min(this.serv.vcrep, envMaxServ)||(flag_ACKdup==1 && this.serv.vcrep <=2) || (flag_ACKdup==1 && Math.floor(this.serv.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
 {
   if (reconocido==0) //ACK NORMAL
   {
     timeout--;
     this.cli.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     let inc: number = this.serv.ult_sn - this.cli.ult_an;
     this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
     }
     else 
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
     }
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     numPqtServEnv--;
     envAck = 0;
   }
   else if (reconocido==1) //ACK DUPLICADO
   {
     timeout--;
     this.cli.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     let inc: number = this.serv.ult_sn - this.cli.ult_an;
     this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
     this.cli.ult_an = this.cli.an;
     ACK_dup++;
     if(ACK_dup == 3)  // TERCER ACK DUPLICADO --> RR
     {
       this.serv.flags = rr;
       this.serv.rr = true;
       umbralserv = Math.round((this.serv.vc/2)*100)/100;
       this.serv.vc=umbralserv+3;
     }
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
     {
       umbralserv = Math.round((this.serv.vcrep/2)*100)/100;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0 });
     }
     else 
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vc, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
     }
     numPqtServEnv--;
     envAck = 0;
     flag_ACKdup=0;
   }
 }
 //SEGMENTOS PERDIDOS
 // Segmento perdido dirección servidor --> cliente
 else if (this.simular.segperdserv2!= null && contadorPqtEnv==segperdNumserv2[y])
 {
   y++;
   sin_ACK++;
   this.serv.flags=nullflag;
   if (envAck < 2)  //SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
   {
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.comprobarEC(this.serv, umbralserv);
     sn_perd = this.serv.sn;
     an_perd = this.serv.an;
     d_perd = denv;
     this.cli.an += ultDataEnv;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
     this.serv.ult_sn = this.serv.sn;
     ultDataEnv = denv;
     contadorPqtEnv++;
     numPqtServEnv--;
     timeout = this.simular.timeout;
     reconocido = 1;
     pqtPerdido = 1;
     envAck++;
     timeout--;
   }
   else //SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
   {
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     sn_perd = this.serv.sn;
     an_perd = this.serv.an;
     d_perd = denv;
     this.cli.an += ultDataEnv;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -20, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
     contadorPqtEnv++;
     numPqtServEnv--;
     timeout = this.simular.timeout;
     reconocido = 1;
     pqtPerdido = 1;
     envAck = 1; 
     timeout--;
     ACK_aux=1;
   }
 }
 //DATOS
 else if (envAck < 2 && sin_ACK < Math.floor(this.serv.vc) && flag_ACKdup==0) 
 {
   timeout--;
   this.cli.flags = nullflag;
   this.serv.ult_sn = this.serv.sn;
   this.serv.sn += ultDataEnv;
   this.comprobarEC(this.serv, umbralserv);
   if (numPqtServEnv==0)this.serv.flags=ack;
   if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
   {
     umbralserv = this.cli.vcrep/2;
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep = 1;
     this.serv.vc = 1;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.flags==ec) this.serv.flags=ecal;
     else this.serv.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
   }
   else
   {
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
    if(pqtPerdido==1)
    {
      sin_ACK++;
      flag_ACKdup=1;
    }
   }
   this.serv.ult_sn = this.serv.sn;
   ultDataEnv = denv;
   envAck++;
   contadorPqtEnv++;
 }
 //SEGMENTO VACÍO (Esperando que caduque el temporizador)
 else if (sin_ACK >= Math.floor(this.serv.vc))
 {
   timeout--;
   numPqtServEnv--;
   if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
   { 
     umbralserv = this.serv.vcrep/2; 
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep=1;
     this.serv.vc=1;
     this.serv.ec = false;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.ec==true) this.serv.flags=ecal;
     else this.serv.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
 }
 //ACK Y DATOS
 else if (denv!=0 || (flag_ACKdup==1 && this.serv.vcrep>2))  { // Cada 2 paquetes enviados por el servidor, el cliente envía ack y el servidor envía datos (flechas cruzadas)
   if (reconocido==0) // ACK NORMAL + DATOS
   {
     timeout--;
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
     }
     ultDataEnv = denv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     envAck = 1;
     contadorPqtEnv++;
   }
   else if (reconocido == 1) //ACK DUPLICADO + DATOS
   {
     timeout --;
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     sin_ACK++;
     if (ACK_aux==0) ACK_dup = 0;
     else ACK_dup++;
     if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR 
     {
       this.serv.flags = rr;
       this.serv.rr = true;
       umbralserv = Math.round((this.serv.vc/2)*100)/100;
       this.serv.vc=umbralserv+3;
       this.serv.vcrep = this.serv.vc;
     }
     if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0 });
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vc,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0});
     }
     ultDataEnv = denv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     contadorPqtEnv++;
     flag_ACKdup=1;
     ACK_aux =1;
   }
 }
//COMPROBACIÓN ERROR SEGMENTOS DE MÁS:
// Si es el penultimo paquete a enviar, sin contar el que se debe reenviar,se prepara para enviar los datos restantes en el último
 if (numPqtServEnv == numPqtServ - 2){ 
  if (pqtPerdido == 1)
      numPqtServEnv += 99;  
 }
//COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
// Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
 if (numPqtServEnv == numPqtServ - 1){ 
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
  if (ACK_dup==3)//REENVÍO POR 3 ACKs DUPLICADOS
  {
    this.serv.ec = false;
    umbralserv = Math.round((this.serv.vc/2)*100)/100;
    this.serv.vc=umbralserv+3;
    this.serv.vcrep= this.serv.vc;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
    this.serv.vc++;
    this.serv.vcrep++;
    envAck++;
    reconocido = 0;
    this.serv.vcrep = umbralserv;
    this.serv.vc = umbralserv;
    this.serv.flags = ec;
    ACK_dup=0;
    sin_ACK=0;
    pqtPerdido = 0;
  }
else if  (flag_ACKdup==1 && Math.floor(this.serv.vcrep) >= sin_ACK) //ACK DUPLICADO
{
  timeout--;
  this.cli.flags = ack;
  this.cli.ult_sn = this.cli.sn;
  this.cli.ult_an = this.cli.an;
  let inc: number = this.serv.ult_sn - this.cli.ult_an;
  this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
  this.cli.ult_an = this.cli.an;
  ACK_dup++;
  if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
  {
    this.serv.flags = rr;
    this.serv.rr = true;
    umbralserv = Math.round((this.serv.vc/2)*100)/100;
    this.serv.vc=umbralserv+3;
    this.serv.vcrep = this.serv.vc;
  }
  if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
  envAck = 0;
  flag_ACKdup=0;
}  
 else if (timeout==0)//REENVÍO DEL PAQUETE
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
   reconocido=0;
   pqtPerdido=0;
   envAck++;
   sin_ACK=0;
   ACK_inm=1;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.cli.ult_sn = this.cli.sn;
   this.cli.ult_an = this.cli.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
   envAck++;
   reconocido=0;
   pqtPerdido=0;
   sin_ACK=0;
   ACK_inm=1;
   }
 }
 else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 {
   timeout--;
   if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
   {
     umbralserv = this.cli.vcrep/2;
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep=1;
     this.serv.vc=1;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.ec==true) this.serv.flags=ecal;
     else this.serv.flags = al;
     this.comprobarEC(this.serv, umbralserv);
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
     
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
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
 this.comprobarEC(this.serv, umbralserv);
 if (NumEnvios==2)
 {
 if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: ack, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
 }
 this.serv.ult_sn = this.serv.sn;
 this.serv.ult_an = this.serv.an;
 this.cli.ult_an = this.cli.an;
}
}
    // ############### TERCER ENVÍO #####################
    if (NumEnvios == 3)
    {
          /*-----ACTUALIZACIÓN DE VARIABLES-----*/
          contadorPqtEnv = 0;  
          ACK_aux = 0;
          timeout = this.simular.timeout;
          x=0;
          y=0;
          // Cliente
          this.cli.data = this.simular.datosclien3;
          this.cli.segperd = this.simular.segperdclien3;
          let numPqtClien: number = Math.floor(this.cli.data / mssClien);
          let numPqtClienEnv: number = 0; //Indica los pqt enviados (para saber cuando terminar)
          let modPqtClien: number = this.cli.data % mssClien;
          let envMaxClien: number = Math.floor(this.serv.w / mssClien);
          var segperdNumclien3 = this.simular.segperdclien3.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico

          //Servidor
          this.serv.data = this.simular.datosserv3;
          this.serv.segperd = this.simular.segperdserv3;
          let numPqtServ: number = Math.floor(this.serv.data / mssServ);
          let numPqtServEnv: number = 0;
          let modPqtServ: number = this.serv.data % mssServ;
          let envMaxServ: number = Math.floor(this.cli.w / mssServ);
          var segperdNumserv3 = this.simular.segperdserv3.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico

     // ----------------------------- LADO CLIENTE -----------------------------------------   
     // >>>>> Envio de datos cliente->servidor <<<<<
     if (numPqtClien == 0)
     denv = modPqtClien;
    else
     denv = mssClien;
    
    //ENVÍO DE PAQUETES
    //############################
    numPqtClienEnv++;
    if (envAck<2 && ACK_inm==0)envAck=0;
    else
    {
      envAck=0;
      ACK_inm=0;
    } 

    for (; numPqtClienEnv <= numPqtClien+1; numPqtClienEnv++) { 
    let x: number=0;
    let numenvio: number=0;
    if (numPqtClienEnv==1)numenvio=3;
    else numenvio=0;
    //REENVÍO PAQUETE PERDIDO
    if ((this.simular.segperdclien3 != null && timeout==0 && pqtPerdido==1) || (this.simular.segperdclien3 != null && ACK_dup==3 && pqtPerdido==1))
    {
     if (this.simular.segperdclien3 != null && timeout==0 && pqtPerdido==1) //REENVÍO POR FIN DEL TIMEOUT
     {
       if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
       {
       this.cli.vcrep+=1;
       this.cli.vc+=1;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
       envAck++;
       reconocido=0;
       ACK_inm = 1;
       pqtPerdido=0;
       }  
       else if (denv !=0) //SEGMENTO BIDIRECCIONAL
       {
       this.cli.vcrep+=1;
       this.cli.vc+=1;
       this.serv.ult_sn = this.serv.sn;
       this.serv.ult_an = this.serv.an;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
       envAck++;
       reconocido=0;
       ACK_inm = 1;
       pqtPerdido=0;
       }
     }
     else // 3 ACK'S DUPLICADOS (SEGMENTO BIDIRECCIONAL)
     {
       this.cli.vc=this.serv.vc + 1;
       this.cli.vcrep=this.cli.vc;
       this.serv.ult_sn = this.serv.sn;
       this.serv.ult_an = this.serv.an;
       ACK_dup++;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: ack, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:0, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
       this.cli.vc++;
       this.cli.vcrep++;
       envAck++;
       reconocido=0;
       ACK_inm = 1;
       pqtPerdido=0;
     }
    }
     //ACK inmediato
     else if (ACK_inm==1)
     {
       if (this.cli.vcrep <= sin_ACK) //SEGMENTO UNIDIRECCIONAL
       {
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
         this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
         this.serv.flags = ack;
         //PASO DE RR -->EC
         if (this.cli.rr==true)
         {
          this.comprobarEC(this.cli, umbralcli);
          if (this.cli.ec==true)
          {
            this.cli.vc=umbralcli;
            this.cli.vcrep=this.cli.vc;
            this.cli.flags=ec;
          }
         }
         else
         {
         this.incrementarVC(this.cli, this.serv, mssClien);
         this.comprobarEC(this.cli, umbralcli);
         }
         this.serv.ult_an = this.serv.an;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
         numPqtClienEnv--; // HACE QUE EL SEGMENTO PERDIDO SE REPITA DOS VECES!! Solucionado con contadorPqtEnv
         envAck = 0;
         flag_ACKdup = 0;
         ACK_inm=0;
         ACK_dup = 0;
         sin_ACK = 0;
         this.cli.rr = false;
         if (this.cli.ec == true) this.cli.flags = ec;
         else this.cli.flags = al;
       }
       else //SEGMENTO BIDIRECCIONAL
       {
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
         this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
         this.serv.flags = ack;
         this.cli.sn += ultDataEnv;
         //PASO DE RR --> EC
         if (this.cli.rr==true)
         {
          this.comprobarEC(this.cli, umbralcli);
          if (this.cli.ec==true)
          {
            this.cli.vc=umbralcli;
            this.cli.vcrep=this.cli.vc;
            this.cli.flags=ec;
          }
         }
         else
         {
         this.incrementarVC(this.cli, this.serv, mssClien);
         this.comprobarEC(this.cli, umbralcli);
         }
         this.serv.ult_an = this.serv.an;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
         envAck = 1;
         flag_ACKdup = 0;
         ACK_inm=0;
         ACK_dup = 0;
         sin_ACK = 0;
         this.cli.rr = false;
         if (this.cli.ec == true) this.cli.flags = ec;
         else this.cli.flags = al;
       }
     }
     //ACK
     else if (envAck == Math.min(this.cli.vcrep, envMaxClien) || (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) <=2) || (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) == sin_ACK) ) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
     {
       if (reconocido==0) //ACK NORMAL
       {
         timeout --;
         this.serv.flags = ack;
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         let inc: number = this.cli.ult_sn - this.serv.ult_an;
         this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
         this.incrementarVC(this.cli, this.serv, mssClien);
         this.comprobarEC(this.cli, umbralcli);
         if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
         {
           umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
           if (umbralcli==0)umbralcli=1;
           this.cli.vcrep=1;
           this.cli.vc=1;
           this.comprobarEC(this.cli, umbralcli);
           if (this.cli.flags==ec) this.cli.flags=ecal;
           else this.cli.flags = al;
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
         }
         else
         {
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
         }
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         numPqtClienEnv--; 
         envAck = 0;
       }
       else if (reconocido==1) // ACK DUPLICADO
       {
         timeout --;
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         let inc: number = this.cli.ult_sn - this.serv.ult_an;
         this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
         this.serv.ult_an = this.serv.an;
         this.serv.flags = ack;
         ACK_dup++;
         if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
         {
           this.cli.flags = rr;
           this.cli.rr = true;
           umbralcli = Math.round((this.cli.vc / 2)*100)/100;
           this.cli.vc=umbralcli + 3;
         }
         if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
         {
           umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
           if (umbralcli==0)umbralcli=1;
           this.cli.vcrep=1;
           this.cli.vc=1;
           this.comprobarEC(this.cli, umbralcli);
           if (this.cli.flags==ec) this.cli.flags=ecal;
           else this.cli.flags = al;
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
         }
         else
         {
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vc, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
         }
         numPqtClienEnv--; 
         envAck = 0; 
         flag_ACKdup = 0;
       }
     }
     //SEGMENTOS PERDIDOS
     // Caso segmento perdido en la dirección cliente -> servidor
     else if (this.simular.segperdclien3!= null && contadorPqtEnv+1==segperdNumclien3[x])
     {
       x++;
       sin_ACK++;
       this.cli.flags=nullflag;
       if (envAck < 2 && denv !=0) //SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
       {
       this.serv.flags= nullflag;
       this.cli.ult_sn = this.cli.sn;
       this.cli.sn += ultDataEnv;
       this.serv.flags= nullflag;
       this.comprobarEC(this.cli, umbralcli);
       sn_perd = this.cli.sn;
       an_perd = this.cli.an;
       d_perd = denv;
       this.serv.an += ultDataEnv;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
       ultDataEnv = denv;
       contadorPqtEnv++;
       numPqtClienEnv--;
       timeout=this.simular.timeout;
       reconocido=1;
       pqtPerdido=1;
       envAck++;
       timeout--;
       }
       else if (denv !=0) //SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
       {
       this.serv.flags = ack;
       this.cli.ult_sn = this.cli.sn;
       this.cli.sn += ultDataEnv;
       this.serv.ult_sn = this.serv.sn;
       this.serv.ult_an = this.serv.an;
       this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
       this.incrementarVC(this.cli, this.serv, mssClien);
       this.comprobarEC(this.cli, umbralcli);
       sn_perd = this.cli.sn;
       an_perd = this.cli.an;
       d_perd = denv;
       this.serv.an += ultDataEnv;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
       contadorPqtEnv++;
       numPqtClienEnv--;
       envAck = 1;
       timeout=this.simular.timeout;
       reconocido=1;
       pqtPerdido=1;
       timeout--;
       ACK_aux=1;
     }
     }
     //PAQUETES DE DATOS
     else if (envAck < 2 && denv !=0 && sin_ACK < Math.floor(this.cli.vc) && flag_ACKdup == 0 ) // El numero de paquetes enviados no alcanza al ACK
     {
       let vc_aux: number=0;
       timeout --;
       this.serv.flags= nullflag;
       this.cli.ult_sn = this.cli.sn;
       this.cli.sn += ultDataEnv;
       this.comprobarEC(this.cli, umbralcli);
       if (numPqtClienEnv==1)
       {
         this.cli.flags=ack;
         vc_aux=this.cli.vcrep;
       }
       if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
       { 
         umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
         if (umbralcli==0)umbralcli=1;
         this.cli.vcrep=1;
         this.cli.vc=1;
         this.comprobarEC(this.cli, umbralcli);
         if (this.cli.flags==ec) this.cli.flags=ecal;
         else this.cli.flags = al;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
       }
       else
       {
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: vc_aux , emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
         if(pqtPerdido==1) 
         {
           flag_ACKdup=1;
           sin_ACK++;
         }
       }
       this.cli.ult_sn = this.cli.sn;
       ultDataEnv = denv;
       envAck++;
       contadorPqtEnv++;      
     }
     //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
     else if (sin_ACK >= Math.floor(this.cli.vc))
     {
       timeout--;
       numPqtClienEnv--;
       if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
       { 
         umbralcli = this.cli.vcrep/2; 
         if (umbralcli==0)umbralcli=1;
         this.cli.vcrep=1;
         this.cli.vc=1;
         this.cli.ec = false;
         this.comprobarEC(this.cli, umbralcli);
         if (this.cli.flags==ec) this.cli.flags=ecal;
         else this.cli.flags = al;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
       }
       else
       {
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
       }
     }
     //ACK Y DATOS 
     else if (denv !=0 || (flag_ACKdup == 1 && this.cli.vcrep >2)){ // Cada 2 paquetes enviados por el cliente, el servidor envia un ACK mientras el cliente envía datos (flechas cruzadas)
       if (reconocido==0) //ACK NORMAL + DATOS
       {  
         timeout--;
         this.serv.flags = ack;
         this.cli.ult_sn = this.cli.sn;
         this.cli.sn += ultDataEnv;
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
         this.incrementarVC(this.cli, this.serv, mssServ);
         this.comprobarEC(this.cli, umbralcli);
         if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
         { 
           umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
           if (umbralcli==0)umbralcli=1;
           this.cli.vcrep=1;
           this.cli.vc=1;
           this.comprobarEC(this.cli, umbralcli);
           if (this.cli.flags==ec) this.cli.flags=ecal;
           else this.cli.flags = al;
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
         }
         else
         {
           if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
         }
         ultDataEnv = denv;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         envAck = 1;
         contadorPqtEnv++;
       }
       else if (reconocido==1) //ACK DUPLICADO + DATOS
       {
         timeout--;
         this.serv.flags = ack;
         this.cli.ult_sn = this.cli.sn;
         this.cli.sn += ultDataEnv;
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
         sin_ACK++;
         if (ACK_aux==0) ACK_dup = 0;
         else ACK_dup++;
         if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
         {
           this.cli.flags = rr;
           this.cli.rr = true;
           umbralcli = Math.round((this.cli.vc / 2)*100)/100;
           this.cli.vc=umbralcli + 3;
           this.cli.vcrep = this.cli.vc;
         }
         if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
         { 
           umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
           if (umbralcli==0)umbralcli=1;
           this.cli.vcrep=1;
           this.cli.vc=1;
           this.comprobarEC(this.cli, umbralcli);
           if (this.cli.flags==ec) this.cli.flags=ecal;
           else this.cli.flags = al; 
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
         }
         else
         {
           if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vc, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
         }
           ultDataEnv = denv;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         envAck = 1;
         contadorPqtEnv++;
         flag_ACKdup=1;
         ACK_aux =1;
       }
     }
    //COMPROBACIÓN ERROR SEGMENTOS DE MÁS:
    // Si es el penultimo paquete a enviar, sin contar el que se debe reenviar,se prepara para enviar los datos restantes en el último
     if (numPqtClienEnv == numPqtClien - 1){ 
      if (pqtPerdido == 1)
          numPqtClienEnv += 99;  
     }
    //COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
    // Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
     if (numPqtClienEnv == numPqtClien){ 
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
      if (ACK_dup==3) //REENVÍO POR 3 ACKs DUPLICADOS
      {
        umbralcli = Math.round ((this.cli.vc / 2)*100)/100;
        this.cli.vc=umbralcli + 3;
        this.cli.vcrep=this.cli.vc;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        this.cli.vc++;
        this.cli.vcrep++;
        envAck++;
        this.cli.vcrep = umbralcli;
        this.cli.vc = umbralcli;
        this.cli.flags = ec;
        reconocido=0;
        sin_ACK=0;
        ACK_dup=0;
        pqtPerdido=0;
      }
      else if (flag_ACKdup ==1 && Math.floor(this.cli.vcrep) >= sin_ACK) //ACK DUPLICADO
      {
        timeout --;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        let inc: number = this.cli.ult_sn - this.serv.ult_an;
        this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
        this.serv.ult_an = this.serv.an;
        this.serv.flags = ack;
        ACK_dup++;
        if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
        {
          this.cli.flags = rr;
          this.cli.rr = true;
        }
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
        envAck = 0; 
        flag_ACKdup = 0;
      }
     else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
     {
       if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
       {
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
       reconocido=0;
       ACK_inm = 0;
       ACK_dup = 0;
       pqtPerdido=0;
       }  
       else if (denv !=0) //SEGMENTO BIDIRECCIONAL
       {
       this.serv.ult_sn = this.serv.sn;
       this.serv.ult_an = this.serv.an;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
       envAck++;
       reconocido=0;
       ACK_inm = 1;
       pqtPerdido=0;
       }
     }
     else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
     {
       timeout--;
       if (timeout==0)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
       {
         umbralcli = this.cli.vcrep/2;
         if (umbralcli==0)umbralcli=1;
         this.cli.vcrep=1;
         this.cli.vc=1;
         this.comprobarEC(this.cli, umbralcli);
         if (this.cli.flags==ec) this.cli.flags=ecal;
         else this.cli.flags = al;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
         
       }
       else
       {
         if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
       }
       }
     }
    }
    

    // ----------------------------- LADO SERVIDOR -----------------------------------------
    if (envAck==1)envAck=0;
    else envAck=0;
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
     this.comprobarEC(this.cli, umbralserv);
    }
    //ACTUALIZACIÓN DE VARIABLES
    ACK_aux=0;
    ultDataEnv = denv; // Tamanyo de los ultimos datos enviados
    envAck = 0;
    sin_ACK =0;
    numPqtServEnv=0;
    contadorPqtEnv= 1;

    for (; numPqtServEnv <= numPqtServ; numPqtServEnv++) {
     //REENVÍO PAQUETE PERDIDO
    if ((this.simular.segperdserv3 != null && timeout==0 && pqtPerdido==1 )|| (this.simular.segperdserv3 != null && ACK_dup==3 && pqtPerdido==1))
    {
       if (this.simular.segperdserv3 != null && timeout==0 && pqtPerdido==1 ) // REENVÍO POR FIN DEL TIMEOUT
       {
       if (envAck < 2)//SEGMENTO UNIDIRECCIONAL
       {
         this.serv.vcrep+=1;
         this.serv.vc+=1;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
         envAck++;
         reconocido = 0;
         ACK_inm = 1;
         pqtPerdido = 0;
       }
       else    //SEGMENTO BIDIRECCIONAL
       {
         this.serv.vcrep+=1;
         this.serv.vc+=1;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
         envAck++;
         reconocido = 0;
         ACK_inm = 1;
         pqtPerdido = 0;
       }
     }
     else // 3 ACK'S DUPLICADOS
     {
         this.serv.ec=false;
         this.serv.vc=this.serv.vc+1;
         this.serv.vcrep= this.serv.vc;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         ACK_dup++;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: ack, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:1, fin_temp:0,umbral:0, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
         this.serv.vc++;
         this.serv.vcrep++;
         envAck++;
         reconocido = 0;
         ACK_inm = 1;
         pqtPerdido = 0;
       
     }
    }
     //ACK INMEDIATO
     else if (ACK_inm==1)
     {
       if (this.serv.vcrep <= sin_ACK)//SEGMENTO UNIDIRECCIONAL
       {
         this.cli.flags = ack;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         let inc: number = Math.abs(this.serv.ult_sn - this.cli.ult_an);
         this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
         //PASO DE RR --> EC
         if (this.serv.rr==true)
         {
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true)
          {
            this.serv.vc=umbralserv;
            this.serv.vcrep=this.serv.vc;
          }
         }
         else
         {
         this.incrementarVC(this.serv, this.cli, mssServ);
         this.comprobarEC(this.serv, umbralserv);
         }
         this.cli.ult_an = this.cli.an;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
         numPqtServEnv--;
         envAck = 0;
         ACK_inm = 0;
         ACK_dup = 0;
         sin_ACK = 0;
         flag_ACKdup = 0;
         this.serv.rr = false;
         if (this.serv.ec == true) this.serv.flags = ec;
         else this.serv.flags = al;
       }
       else // SEGMENTO BIDIRECCIONAL
       {
         this.cli.flags = ack;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         let inc: number = Math.abs(this.serv.ult_sn - this.cli.ult_an);
         this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
         this.serv.sn += ultDataEnv;
         //PASO DE RR --> EC
         if (this.serv.rr==true)
         {
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true)
          {
            this.serv.vc=umbralserv;
            this.serv.vcrep=this.serv.vc;
          }
         }
         else
         {
         this.incrementarVC(this.serv, this.cli, mssServ);
         this.comprobarEC(this.serv, umbralserv);
         }
         this.cli.ult_an = this.cli.an;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
         envAck = 1;
         ACK_inm = 0;
         ACK_dup = 0;
         sin_ACK = 0;
         flag_ACKdup = 0;
         this.serv.rr = false;
         if (this.serv.ec == true) this.serv.flags = ec;
         else this.serv.flags = al;
       }
     }
     //ACK
     else if (envAck == Math.min(this.serv.vcrep, envMaxServ)||(flag_ACKdup==1 && this.serv.vcrep <=2) || (flag_ACKdup==1 && Math.floor(this.serv.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
     {
       if (reconocido==0) //ACK NORMAL
       {
         timeout--;
         this.cli.flags = ack;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         let inc: number = this.serv.ult_sn - this.cli.ult_an;
         this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
         this.incrementarVC(this.serv, this.cli, mssServ);
         this.comprobarEC(this.serv, umbralserv);
         if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
         {
           umbralserv = this.serv.vcrep/2;
           if (umbralserv==0)umbralserv=1;
           this.serv.vcrep = 1;
           this.serv.vc = 1;
           this.comprobarEC(this.serv, umbralserv);
           if (this.serv.ec==true) this.serv.flags=ecal;
           else this.serv.flags = al;
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
         }
         else 
         {
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
         }
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         numPqtServEnv--;
         envAck = 0;
       }
       else if (reconocido==1) //ACK DUPLICADO
       {
         timeout--;
         this.cli.flags = ack;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         let inc: number = this.serv.ult_sn - this.cli.ult_an;
         this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
         this.cli.ult_an = this.cli.an;
         ACK_dup++;
         if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
         {
           this.serv.flags = rr;
           this.serv.rr = true;
           umbralserv = Math.round((this.serv.vc/2)*100)/100;
           this.serv.vc=umbralserv+3;
         }
         if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
         {
           umbralserv = Math.round((this.serv.vcrep/2)*100)/100;
           if (umbralserv==0)umbralserv=1;
           this.serv.vcrep = 1;
           this.serv.vc = 1;
           this.comprobarEC(this.serv, umbralserv);
           if (this.serv.ec==true) this.serv.flags=ecal;
           else this.serv.flags = al;
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0 });
         }
         else 
         {
           if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vc, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
         }
         numPqtServEnv--;
         envAck = 0;
         flag_ACKdup=0;
       }
     }
     //SEGMENTOS PERDIDOS
     // Segmento perdido dirección servidor --> cliente
     else if (this.simular.segperdserv3!= null && contadorPqtEnv==segperdNumserv3[y])
     {
       y++;
       sin_ACK++;
       this.serv.flags=nullflag;
       if (envAck < 2) //SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
       {
         this.serv.ult_sn = this.serv.sn;
         this.serv.sn += ultDataEnv;
         this.comprobarEC(this.serv, umbralserv);
         sn_perd = this.serv.sn;
         an_perd = this.serv.an;
         d_perd = denv;
         this.cli.an += ultDataEnv;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
         this.serv.ult_sn = this.serv.sn;
         ultDataEnv = denv;
         contadorPqtEnv++;
         numPqtServEnv--;
         timeout = this.simular.timeout;
         reconocido = 1;
         pqtPerdido = 1;
         envAck++;
         timeout--;
       }
       else //SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
       {
         this.cli.flags = ack;
         this.serv.ult_sn = this.serv.sn;
         this.serv.sn += ultDataEnv;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
         this.incrementarVC(this.serv, this.cli, mssServ);
         this.comprobarEC(this.serv, umbralserv);
         sn_perd = this.serv.sn;
         an_perd = this.serv.an;
         d_perd = denv;
         this.cli.an += ultDataEnv;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -20, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
         contadorPqtEnv++;
         numPqtServEnv--;
         timeout = this.simular.timeout;
         reconocido = 1;
         pqtPerdido = 1;
         envAck = 1; 
         timeout--;
         ACK_aux=1;
       }
     }
     //DATOS
     else if (envAck < 2 && sin_ACK < Math.floor(this.serv.vc) && flag_ACKdup==0) // El numero de paquetes enviados no alcanza al ACK
     {
       timeout--;
       this.cli.flags = nullflag;
       this.serv.ult_sn = this.serv.sn;
       this.serv.sn += ultDataEnv;
       this.comprobarEC(this.serv, umbralserv);
       if (numPqtServEnv==0)this.serv.flags=ack;
       if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
       {
         umbralserv = this.cli.vcrep/2;
         if (umbralserv==0)umbralserv=1;
         this.serv.vcrep = 1;
         this.serv.vc = 1;
         this.comprobarEC(this.serv, umbralserv);
         if (this.serv.flags==ec) this.serv.flags=ecal;
         else this.serv.flags = al;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
       }
       else
       {
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
       if(pqtPerdido==1)
       {
       sin_ACK++;
       flag_ACKdup=1;
       }
     }
       this.serv.ult_sn = this.serv.sn;
       ultDataEnv = denv;
       envAck++;
       contadorPqtEnv++;
     }
     //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
     else if (sin_ACK >= Math.floor(this.serv.vc))
     {
       timeout--;
       numPqtServEnv--;
       if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
       { 
         umbralserv = this.serv.vcrep/2; 
         if (umbralserv==0)umbralserv=1;
         this.serv.vcrep=1;
         this.serv.vc=1;
         this.serv.ec = false;
         this.comprobarEC(this.serv, umbralserv);
         if (this.serv.ec==true) this.serv.flags=ecal;
         else this.serv.flags = al;
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
       }
       else
       {
         if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
       }
     }
     //ACK Y DATOS
     else if (denv!=0 || (flag_ACKdup==1 && this.serv.vcrep>2))  { // Cada 2 paquetes enviados por el servidor, el cliente envía ack y el servidor envía datos (flechas cruzadas)
       if (reconocido==0) //ACK NORMAL + DATOS
       {
         timeout--;
         this.cli.flags = ack;
         this.serv.ult_sn = this.serv.sn;
         this.serv.sn += ultDataEnv;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
         this.incrementarVC(this.serv, this.cli, mssServ);
         this.comprobarEC(this.serv, umbralserv);
         if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
         {
           umbralserv = this.serv.vcrep/2;
           if (umbralserv==0)umbralserv=1;
           this.serv.vcrep = 1;
           this.serv.vc = 1;
           this.comprobarEC(this.serv, umbralserv);
           if (this.serv.ec==true) this.serv.flags=ecal;
           else this.serv.flags = al;
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
         }
         else
         {
           if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
         }
         ultDataEnv = denv;
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         envAck = 1;
         contadorPqtEnv++;
       }
       else if (reconocido == 1) //ACK DUPLICADO + DATOS
       {
         timeout --;
         this.cli.flags = ack;
         this.serv.ult_sn = this.serv.sn;
         this.serv.sn += ultDataEnv;
         this.cli.ult_sn = this.cli.sn;
         this.cli.ult_an = this.cli.an;
         this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
         sin_ACK++;
         if (ACK_aux==0) ACK_dup = 0;
         else ACK_dup++;
         if(ACK_dup == 3)  //TERCER ACK DUPLICADO --> RR 
         {
           this.serv.flags = rr;
           this.serv.rr = true;
           umbralserv = Math.round((this.serv.vc/2)*100)/100;
           this.serv.vc=umbralserv+3;
         }
         if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
         {
           umbralserv = this.serv.vcrep/2;
           if (umbralserv==0)umbralserv=1;
           this.serv.vcrep = 1;
           this.serv.vc = 1;
           this.comprobarEC(this.serv, umbralserv);
           if (this.serv.ec==true) this.serv.flags=ecal;
           else this.serv.flags = al;
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0 });
         }
         else
         {
           if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vc,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup, NumEnvio:0});
         }
         ultDataEnv = denv;
         this.serv.ult_sn = this.serv.sn;
         this.serv.ult_an = this.serv.an;
         contadorPqtEnv++;
         flag_ACKdup=1;
         ACK_aux =1;
       }
     }
    //COMPROBACIÓN ERROR SEGMENTOS DE MÁS:
    // Si es el penultimo paquete a enviar, sin contar el que se debe reenviar,se prepara para enviar los datos restantes en el último
     if (numPqtServEnv == numPqtServ - 2){ 
      if (pqtPerdido == 1)
          numPqtServEnv += 99;  
     }
    //COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
    // Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
     if (numPqtServEnv == numPqtServ - 1){ 
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
      if (ACK_dup==3)//REENVÍO POR 3 ACKs DUPLICADOS
      {
        this.serv.ec = false;
        umbralserv = Math.round((this.serv.vc/2)*100)/100;
        this.serv.vc=umbralserv+3;
        this.serv.vcrep= this.serv.vc;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
        this.serv.vc++;
        this.serv.vcrep++;
        envAck++;
        this.serv.vcrep = umbralserv;
        this.serv.vc = umbralserv;
        this.serv.flags = ec;
        reconocido = 0;
        ACK_dup=0;
        sin_ACK=0;
        pqtPerdido = 0;
      }
    else if  (flag_ACKdup==1 && Math.floor(this.serv.vcrep) >= sin_ACK) //ACK DUPLICADO
    {
      timeout--;
      this.cli.flags = ack;
      this.cli.ult_sn = this.cli.sn;
      this.cli.ult_an = this.cli.an;
      let inc: number = this.serv.ult_sn - this.cli.ult_an;
      this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
      this.cli.ult_an = this.cli.an;
      ACK_dup++;
      if(ACK_dup == 3) //TERCER ACK DUPLICADO --> RR
      {
        this.serv.flags = rr;
        this.serv.rr = true;
        umbralserv = Math.round((this.serv.vc/2)*100)/100;
        this.serv.vc=umbralserv+3;
      }
      if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:ACK_dup , NumEnvio:0});
      envAck = 0;
      flag_ACKdup=0;
    }  
    else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
     {
       if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
       {
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
       reconocido=0;
       pqtPerdido=0;
       envAck++;
       }  
       else if (denv !=0) //SEGMENTO BIDIRECCIONAL
       {
       this.cli.ult_sn = this.cli.sn;
       this.cli.ult_an = this.cli.an;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
       envAck++;
       reconocido=0;
       pqtPerdido=0;
       }
     }
     else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
     {
       timeout--;
       if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
       {
         umbralserv = this.cli.vcrep/2;
         if (umbralserv==0)umbralserv=1;
         this.serv.vcrep=1;
         this.serv.vc=1;
         this.comprobarEC(this.serv, umbralserv);
         if (this.serv.ec==true) this.serv.flags=ecal;
         else this.serv.flags = al;
         this.comprobarEC(this.serv, umbralserv);
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
         
       }
       else
       {
         if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
       }
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
     this.comprobarEC(this.serv, umbralserv);
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: ack, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     this.cli.ult_an = this.cli.an;
    }
    }
    // El cliente espera 1 tick por si hay intercambio de informacion y luego se procede a cerrar
    if (envAck == 2 && cierre == "1")
    { 
      if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
    }
  
    // ----- CIERRE -----
    // Enviamos los segmentos de FIN; FIN, ACK; y ACK
    if (cierre == "1") { // El cliente cierra la conexion
      //FIN
      this.cli.ult_sn = this.cli.sn;
      this.cli.flags = fin;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:0, envio:0 , Num_ACKdup:0, NumEnvio:0});
      // FIN, ACK
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += denv;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + 1;
      this.serv.flags = finack;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0 ,emisor:2, pqt_rtx:0, fin_temp:0,umbral:0, envio:0, Num_ACKdup:0, NumEnvio:0});
      // ACK
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn++;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + 1;
      this.cli.flags = ack;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:0, envio:0, Num_ACKdup:0, NumEnvio:0 });

    } else { // El servidor cierra la conexion
      // FIN
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += denv;
      this.serv.ult_an = this.serv.an;
      this.serv.flags = fin;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:0, envio:1, Num_ACKdup:0, NumEnvio:0});
      // FIN, ACK
      this.cli.ult_sn = this.cli.sn;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + 1;
      this.cli.flags = finack;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:0, envio:1, Num_ACKdup:0, NumEnvio:0 });
      // ACK
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn++;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + 1;
      this.serv.flags = ack;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0 ,umbral:0, envio:1, Num_ACKdup:0, NumEnvio:0});
    }
  
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
    let ec: string[] = ["", "", "", "", "EC", "",""];
    let ecal: string[] = ["", "", "", "AL", "EC", "",""];
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
    let umbralcli: number = this.simular.umbral;
    let umbralserv: number = this.simular.umbral;
    let algort: string = this.simular.algort;
    let cierre: string = this.simular.cierre;
    let pasoapaso: number = this.simular.pasoapaso;
    let NumEnvios: number = this.simular.envios;
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
    var segperdNumclien = this.simular.segperdclien.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico

    //Servidor
    let mssServ: number = Math.min(mss, this.cli.w);
    let numPqtServ: number = Math.floor(this.serv.data / mssServ);
    let numPqtServEnv: number = 0;
    let modPqtServ: number = this.serv.data % mssServ;
    let envMaxServ: number = Math.floor(this.cli.w / mssServ);
    var segperdNumserv = this.simular.segperdserv.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico


    let pqtPerdido: number =0; //0 Si no hay pqt perdido o se ha retransmitido  1 Si hay paquete perdido sin retransmitir
   
    // ----- Conexion -----
    // Enviamos los segmentos de SYN; SYN, ACK; y ACK
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: 0, dcli: 0, wcli: this.cli.w, msscli: this.simular.mssclien, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0 });
    this.serv.ult_an = this.serv.an;
    this.serv.an = this.cli.sn + 1;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: this.simular.mssserv, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0 });
    this.serv.flags = nullflag;
    this.cli.ult_sn = this.cli.sn;
    this.cli.sn += 1;
    this.cli.ult_an = this.cli.an;
    this.cli.an = this.serv.sn + 1;
    this.cli.flags = ack;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0 });
    this.cli.flags = nullflag;

    // ----------------------------- LADO CLIENTE -----------------------------------------   
 // >>>>> Envio de datos cliente->servidor <<<<<
    if (numPqtClien == 0)
      denv = modPqtClien;
    else
      denv = mssClien;
    //PRIMER ENVIO
    //#########################
    
    let x: number=0;
    let y: number=0;
    let reconocido: number = 0; //1--> El segmento perdido no ha sido reconocido  0--> El segmento perdido ha sido reconocido
    let sn_perd: number;
    let an_perd: number;
    let d_perd: number;
    let envAck: number = 0;        // Cada dos paquetes enviados por el cliente, el servidor devuelve un ACK
    let ultDataEnv: number = denv; // Tamanyo de los ultimos datos enviados
    let ACK_inm: number = 0;       // Indica si se debe enviar un ACK inmediato
    let ACK_dup: number =0;        // Indica el número de ACKs duplicados enviados
    let ACK_aux: number =0;
    let flag_ACKdup: number = 0;   // Flag que indica si el ACK es un ACK duplicado
    let sin_ACK: number = 0;       //Número de segmentos sin reconocer

    // >>>>> Si el primer segmento se pierde <<<<<
    if (this.simular.segperdclien != null && contadorPqtEnv+1==segperdNumclien[x])
    {
      x++;
      this.cli.flags=nullflag;
      sn_perd = this.cli.sn;
      an_perd = this.cli.an;
      d_perd = denv;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1 , pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:1});
      contadorPqtEnv++;
      timeout= this.simular.timeout;
      reconocido=1;
      pqtPerdido=1;
      timeout--;
    }
    else 
    {
    // El cliente envía el primer paquete
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1 , pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:1});
    numPqtClienEnv++;
    contadorPqtEnv++;
    }
    //SI HAY SEGMENTO PENDIENTE DE REENVÍO SE REENVÍA O SE ESPERA A QUE VENZA EL TIMER
    if (pqtPerdido==1)
    {
      for(;pqtPerdido==1;)
      {
        if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
        {
          if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
          {
          this.cli.vcrep+=1;
          this.cli.vc+=1;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc:0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          reconocido=0;
          ACK_inm = 1;
          pqtPerdido=0;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});

        }  
        }
        else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
        {
          timeout--;
          if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralcli = this.cli.vcrep/2;
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          }
          else
          {
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          }
        }
      }
    }
    //ACK PRIMER PAQUETE
    //#####################
    if (numPqtClien != 0 && segperdNumclien[0]!=1) // Si hay mas de un paquete a enviar
    {
      // El servidor espera 1 tick por si recibe otro paquete
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});

      // El servidor manda el ACK del primer paquete
      this.serv.flags = ack;
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += 1;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + denv;
      this.incrementarVC(this.cli, this.serv, mssClien);
      this.comprobarEC(this.cli, umbralcli);
      //ACK
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2 , pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
      this.cli.ult_an = this.serv.an;
    }

    //RESTO DE PAQUETES
    //############################
  for (; numPqtClienEnv <= numPqtClien; numPqtClienEnv++) { 
    let x: number=0;
    //REENVÍO PAQUETE PERDIDO
    if ((this.simular.segperdclien != null && timeout==0 && pqtPerdido==1) || (this.simular.segperdclien != null && ACK_dup==3 && pqtPerdido==1))
    {
      if (this.simular.segperdclien != null && timeout==0 && pqtPerdido==1) //REENVÍO POR FIN DEL TEMPORIZADOR
      {
        if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
        {
        this.cli.vcrep+=1;
        this.cli.vc+=1;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }  
        else if (denv !=0) //SEGMENTO BIDIRECCIONAL
        {
        this.cli.vcrep+=1;
        this.cli.vc+=1;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }
      }
      else // 3 ACK'S DUPLICADOS
      {
        if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
        {
        umbralcli = Math.round((this.cli.vc / 2)*100)/100;
        this.cli.vc=1;
        this.cli.vcrep=1;
        this.cli.ec = false;
        this.comprobarEC(this.cli, umbralcli);
        if (this.cli.flags==ec) this.cli.flags=ecal;
        else this.cli.flags = al;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        this.cli.vc++;
        this.cli.vcrep++;
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }  
        else if (denv !=0) //SEGMENTO BIDIRECCIONAL
        {
        umbralcli = Math.round((this.cli.vc / 2)*100)/100;
        this.cli.vc=1;
        this.cli.vcrep=1;
        this.cli.ec = false;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        this.comprobarEC(this.cli, umbralcli);
        if (this.cli.flags==ec) this.cli.flags=ecal;
        else this.cli.flags = al;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: al, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        this.cli.vc++;
        this.cli.vcrep++;
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        this.cli.ec = false;
        }
      }
    }
      //ACK INMEDIATO
      else if (ACK_inm==1)
      {
        
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
        this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
        this.serv.flags = ack;
        this.incrementarVC(this.cli, this.serv, mssClien);
        this.comprobarEC(this.cli, umbralcli);
        this.serv.ult_an = this.serv.an;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0 });
        numPqtClienEnv--; 
        envAck = 0; 
        ACK_inm=0;
        ACK_dup = 0;
        flag_ACKdup = 0;
        sin_ACK = 0;
      }
      //ACK
      else if (envAck == Math.min(this.cli.vcrep, envMaxClien)||(flag_ACKdup==1 && this.cli.vcrep <= 2) || (flag_ACKdup==1 && Math.floor(this.cli.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
      {
        if (reconocido==0) //ACK NORMAL
        {
          timeout --;
          this.serv.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          let inc: number = this.cli.ult_sn - this.serv.ult_an;
          this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
          this.incrementarVC(this.cli, this.serv, mssClien);
          this.comprobarEC(this.cli, umbralcli);
          if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:0});
          }
          else
          {
            if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:0});
          }
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          numPqtClienEnv--; 
          envAck = 0;
        }
        else if (reconocido==1)//ACK DUPLICADO
        {
          timeout --;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          let inc: number = this.cli.ult_sn - this.serv.ult_an;
          this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
          this.serv.flags = ack;
          ACK_dup++;
          if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.cli.flags = nullflag;
            this.cli.ec = false;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          else
          {
            if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          numPqtClienEnv--; // HACE QUE EL SEGMENTO PERDIDO SE REPITA DOS VECES!! Solucionado con contadorPqtEnv
          envAck = 0; 
          flag_ACKdup = 0;
        }
      }
      //SEGMENTOS PERDIDOS
      // Caso segmento perdido en la dirección cliente -> servidor
      else if (this.simular.segperdclien!= null && contadorPqtEnv+1==segperdNumclien[x])
      {
        x++;
        this.cli.flags=nullflag;
        sin_ACK++;
        if (envAck < 2 && denv !=0) //SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
        {
        this.serv.flags= nullflag;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.serv.flags= nullflag;
        this.comprobarEC(this.cli, umbralcli);
        sn_perd = this.cli.sn;
        an_perd = this.cli.an;
        d_perd = denv;
        this.serv.an += ultDataEnv;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        ultDataEnv = denv;
        contadorPqtEnv++;
        numPqtClienEnv--;
        timeout=this.simular.timeout;
        reconocido=1;
        pqtPerdido=1;
        timeout--;
        envAck++;
        }
        else if (denv !=0) //SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
        {
        this.serv.flags = ack;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
        this.incrementarVC(this.cli, this.serv, mssClien);
        this.comprobarEC(this.cli, umbralcli);
        sn_perd = this.cli.sn;
        an_perd = this.cli.an;
        d_perd = denv;
        this.serv.an += ultDataEnv;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:0});
        contadorPqtEnv++;
        numPqtClienEnv--;
        envAck = 1;
        timeout=this.simular.timeout;
        reconocido=1;
        pqtPerdido=1;
        timeout--;
        ACK_aux=1;
      }
      }
      //PAQUETES DE DATOS
      else if (envAck < 2 && denv !=0 && sin_ACK < Math.floor(this.cli.vc) && flag_ACKdup == 0 ) // El numero de paquetes enviados no alcanza al ACK
      {
        timeout --;
        this.serv.flags= nullflag;
        this.cli.ult_sn = this.cli.sn;
        this.cli.sn += ultDataEnv;
        this.comprobarEC(this.cli, umbralcli);
        if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
        { 
          umbralcli = this.cli.vcrep/2; 
          if (umbralcli==0)umbralcli=1;
          this.cli.vcrep=1;
          this.cli.vc=1;
          this.comprobarEC(this.cli, umbralcli);
          if (this.cli.flags==ec) this.cli.flags=ecal;
          else this.cli.flags = al;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
        else
        {
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 , emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          if(pqtPerdido==1) 
          {
            flag_ACKdup=1;
            sin_ACK++;
          }
        }
        this.cli.ult_sn = this.cli.sn;
        ultDataEnv = denv;
        envAck++;
        contadorPqtEnv++;      
      }
      //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
      else if (sin_ACK >= Math.floor(this.cli.vc))
      {
        timeout--;
        numPqtClienEnv--;
        if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
        { 
          umbralcli = this.cli.vcrep/2; 
          if (umbralcli==0)umbralcli=1;
          this.cli.vcrep=1;
          this.cli.vc=1;
          this.cli.ec = false;
          this.comprobarEC(this.cli, umbralcli);
          if (this.cli.flags==ec) this.cli.flags=ecal;
          else this.cli.flags = al;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
        else
        {
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
      } 
      //ACK Y DATOS 
      else if (denv !=0 || (flag_ACKdup == 1 && this.cli.vcrep >2)){ // Cada 2 paquetes enviados por el cliente, el servidor envia un ACK mientras el cliente envía datos (flechas cruzadas)
        if (reconocido==0) //ACK NORMAL + DATOS
        {  
          timeout--;
          this.serv.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.sn += ultDataEnv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
          this.incrementarVC(this.cli, this.serv, mssServ);
          this.comprobarEC(this.cli, umbralcli);
          if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          { 
            umbralcli = this.cli.vcrep/2;
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            this.comprobarEC(this.cli, umbralcli);
            if (this.cli.flags==ec) this.cli.flags=ecal;
            else this.cli.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          }
          else
          {
            if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
          }
          ultDataEnv = denv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          envAck = 1;
          contadorPqtEnv++;
        }
        else if (reconocido==1) //ACK DUPLICADO + DATOS
        {
          timeout--;
          this.serv.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.sn += ultDataEnv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
          sin_ACK++;
          if (ACK_aux==0) ACK_dup = 0;
          else ACK_dup++;
          if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          { 
            umbralcli = this.cli.vcrep/2; 
            if (umbralcli==0)umbralcli=1;
            this.cli.vcrep=1;
            this.cli.vc=1;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          else
          {
            if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          ultDataEnv = denv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          envAck = 1;
          contadorPqtEnv++;
          flag_ACKdup=1;
          ACK_aux =1;
        }

      }
      //COMPROBACIÓN ERROR MÁS SEGMENTOS DE LO NORMAL: 
      //Si estamos en el antepenúlitmo paquete a enviar y hay segmento perdido salimos del bucle Y reenviamos fuera
      if (numPqtClienEnv == numPqtClien -2) 
      {
        if (pqtPerdido==1)
        {
          numPqtClienEnv += 99;
        }
      }
      //COMPROBACIÓN ERROR SEGMENTO VACÍO:
      //Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
      if (numPqtClienEnv == numPqtClien - 1){ 
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
      if (ACK_dup==3) //REENVÍO POR 3 ACKs DUPLICADOS
      {
        umbralcli = Math.round((this.cli.vc / 2)*100)/100;
        this.cli.vc=1;
        this.cli.vcrep=1;
        this.cli.ec = false;
        this.comprobarEC(this.cli, umbralcli);
        if (this.cli.flags==ec) this.cli.flags=ecal;
        else this.cli.flags = al;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        this.cli.vc++;
        this.cli.vcrep++;
        envAck++;
        reconocido=0;
        sin_ACK=0;
        ACK_dup=0;
        ACK_inm = 1;
        pqtPerdido=0;
      }
      else if (flag_ACKdup==1 && Math.floor(this.cli.vcrep) >= sin_ACK) //ACK DUPLICADO
      {
        timeout --;
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        let inc: number = this.cli.ult_sn - this.serv.ult_an;
        this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
        this.serv.flags = ack;
        ACK_dup++;
        if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
        numPqtClienEnv--; 
        envAck = 0; 
        flag_ACKdup = 0;
      }
      else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
      {
        if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
        {
        this.comprobarEC(this.cli, umbralcli);
        if (this.cli.flags==ec) this.cli.flags=ecal;
        else this.cli.flags = al;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }  
        else if (denv !=0) //SEGMENTO BIDIRECCIONAL
        {
        this.serv.ult_sn = this.serv.sn;
        this.serv.ult_an = this.serv.an;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        envAck++;
        reconocido=0;
        ACK_inm = 1;
        pqtPerdido=0;
        }
      }
      else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
      {
        timeout--;
        if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
        {
          umbralcli = this.cli.vcrep/2;
          if (umbralcli==0)umbralcli=1;
          this.cli.vcrep=1;
          this.cli.vc=1;
          this.comprobarEC(this.cli, umbralcli);
          if (this.cli.flags==ec) this.cli.flags=ecal;
          else this.cli.flags = al;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
        else
        {
          this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
      }

      }
    }

    // ----------------------------- LADO SERVIDOR -----------------------------------------
    //ACTUALIZACIÓN DE VARIABLES
    sin_ACK=0;
    contadorPqtEnv=0;
    numPqtServEnv=0;
    ACK_aux=0;

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
      this.comprobarEC(this.cli, umbralserv);
    }
      
      for (;numPqtServEnv<1;)
      {
        if (this.simular.segperdserv != null && contadorPqtEnv+1==segperdNumserv[y])//Si el primer paquete se pierde
        {
          y++;
          this.serv.flags = ack;
          timeout = this.simular.timeout;
          sn_perd = this.serv.sn;
          an_perd = this.serv.an;
          d_perd = denv;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
          contadorPqtEnv++;
          reconocido = 1;
          pqtPerdido = 1;
          timeout--;
        }
        else if (pqtPerdido != 1) //ENVÍO PRIMER PAQUETE
        {
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an++;
          this.serv.ult_an = this.serv.an;
          this.cli.flags = nullflag;
          contadorPqtEnv++;
          numPqtServEnv++;
          ACK_inm=0;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
        }
        if (pqtPerdido == 1 && timeout != 0) //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
        {
          timeout--;
          if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            this.serv.vcrep=1;
            this.serv.vc=1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          }
            else
            {
              if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
            }
          }
        if (pqtPerdido == 1 && timeout ==0) //REENVÍO PRIMER PAQUETE POR FIN DEL TEMPORIZADOR
        {
          this.serv.flags=nullflag;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: ack, snserv: sn_perd, anserv: an_perd, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
          contadorPqtEnv++;
          numPqtServEnv++;
          pqtPerdido=0;
          // El cliente espera 1 tick por si recibe otro paquete
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0 });
        }
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
      this.comprobarEC(this.serv, umbralserv);
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
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
    ultDataEnv = denv; // Tamanyo de los ultimos datos enviados
    envAck = 0;
  //RESTO DE PAQUETES
  for (; numPqtServEnv <= numPqtServ; numPqtServEnv++) {
      //REENVÍO PAQUETE PERDIDO
    if ((this.simular.segperdserv != null && timeout==0 && pqtPerdido==1 )|| (this.simular.segperdserv != null && ACK_dup==3 && pqtPerdido==1))
    {
        if (this.simular.segperdserv != null && timeout==0 && pqtPerdido==1 ) // REENVÍO POR FIN DEL TIMEOUT
        {
        if (envAck < 2)//SEGMENTO UNIDIRECCIONAL
        {
          this.serv.vcrep+=1;
          this.serv.vc+=1;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
        else    //SEGMENTO BIDIRECCIONAL
        {
          this.serv.vcrep+=1;
          this.serv.vc+=1;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
      }
      else // 3 ACK'S DUPLICADOS
      {
        if (envAck < 2) //SEGMENTO UNIDIRECCIONAL
        {
          this.serv.ec = false;
          umbralserv = Math.round((this.serv.vc/2)*100)/100;
          this.serv.vc=1;
          this.serv.vcrep=1;
          this.serv.ec = false;
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true) this.serv.flags=ecal;
          else this.serv.flags = al;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          this.serv.vc++;
          this.serv.vcrep++;
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          pqtPerdido = 0;
        }
        else    //SEGMENTO BIDIRECCIONAL
        {
          this.serv.ec=false;
          umbralserv = this.serv.vc/2;
          this.serv.vc=umbralserv+3;
          this.serv.vcrep= this.serv.vc;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: al, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
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
        this.comprobarEC(this.serv, umbralserv);
        this.cli.ult_an = this.cli.an;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
        numPqtServEnv--;
        envAck = 0;
        ACK_inm = 0;
        ACK_dup = 0;
        sin_ACK = 0;
        flag_ACKdup = 0;
      }
      //ACK
      else if (envAck == Math.min(this.serv.vcrep, envMaxServ)||(flag_ACKdup==1 && this.serv.vcrep <=2)||(flag_ACKdup==1 && Math.floor (this.serv.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
      {
        if (reconocido==0) //ACK NORMAL
        {
          timeout--;
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = this.serv.ult_sn - this.cli.ult_an;
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbralserv);
          if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralserv = this.serv.vcrep/2;
            if (umbralserv==0)umbralserv=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          }
          else 
          {
            if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          }
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          numPqtServEnv--;
          envAck = 0;
        }
        else if (reconocido==1) //ACK DUPLICADO
        {
          timeout--;
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = this.serv.ult_sn - this.cli.ult_an;
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          ACK_dup++;
          if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralserv = this.serv.vcrep/2;
            if (umbralserv==0)umbralserv=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup: ACK_dup , NumEnvio:0});
          }
          else 
          {
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup: ACK_dup, NumEnvio:0});
          }
          numPqtServEnv--;
          envAck = 0; 
          flag_ACKdup = 0;
        }
      }
      //SEGMENTOS PERDIDOS
      // Segmento perdido dirección servidor --> cliente
      else if (this.simular.segperdserv!= null && contadorPqtEnv==segperdNumserv[y])
      {
        y++;
        this.serv.flags=nullflag;
        sin_ACK++;
        if (envAck < 2) //SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
        {
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.comprobarEC(this.serv, umbralserv);
          sn_perd = this.serv.sn;
          an_perd = this.serv.an;
          d_perd = denv;
          this.cli.an += ultDataEnv;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          this.serv.ult_sn = this.serv.sn;
          ultDataEnv = denv;
          contadorPqtEnv++;
          numPqtServEnv--;
          timeout = this.simular.timeout;
          reconocido = 1;
          pqtPerdido = 1;
          timeout--;
          envAck++;
        }
        else //SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
        {
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbralserv);
          sn_perd = this.serv.sn;
          an_perd = this.serv.an;
          d_perd = denv;
          this.cli.an += ultDataEnv;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -20, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          contadorPqtEnv++;
          numPqtServEnv--;
          timeout = this.simular.timeout;
          reconocido = 1;
          pqtPerdido = 1;
          envAck = 1; 
          timeout--;
          ACK_aux=1;
        }
      }
      //DATOS
      else if (envAck < 2 && sin_ACK < Math.floor(this.serv.vc) && flag_ACKdup == 0) // El numero de paquetes enviados no alcanza al ACK
      {
        timeout--;
        this.cli.flags = nullflag;
        this.serv.ult_sn = this.serv.sn;
        this.serv.sn += ultDataEnv;
        this.comprobarEC(this.serv, umbralserv);
        if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
        {
          umbralserv = this.cli.vcrep/2;
          if (umbralserv==0)umbralserv=1;
          this.serv.vcrep = 1;
          this.serv.vc = 1;
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true) this.serv.flags=ecal;
          else this.serv.flags = al;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
        }
        else
        {
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          if(pqtPerdido==1) 
          {
            flag_ACKdup=1;
            sin_ACK++;
          }
        } 
        this.serv.ult_sn = this.serv.sn;
        ultDataEnv = denv;
        envAck++;
        contadorPqtEnv++;
      }
      //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
      else if (sin_ACK >= Math.floor(this.serv.vc))
      {
        timeout--;
        numPqtServEnv--;
        if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
        { 
          umbralserv = this.serv.vcrep/2; 
          if (umbralserv==0)umbralserv=1;
          this.serv.vcrep=1;
          this.serv.vc=1;
          this.serv.ec = false;
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true) this.serv.flags=ecal;
          else this.serv.flags = al;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
        }
        else
        {
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
      }
      //ACK Y DATOS
      else if (denv != 0 || (flag_ACKdup == 1 && this.serv.vcrep >2)) { // Cada 2 paquetes enviados por el servidor, el cliente envía ack y el servidor envía datos (flechas cruzadas)
        if (reconocido==0) //ACK NORMAL + DATOS
        {
          timeout--;
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          this.incrementarVC(this.serv, this.cli, mssServ);
          this.comprobarEC(this.serv, umbralserv);
          if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralserv = this.serv.vcrep/2;
            if (umbralserv==0)umbralserv=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          }
          else
          {
            if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          }
          ultDataEnv = denv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          envAck = 1;
          contadorPqtEnv++;
        }
        else if (reconocido == 1) //ACK DUPLICADO
        {
          timeout --;
          this.cli.flags = ack;
          this.serv.ult_sn = this.serv.sn;
          this.serv.sn += ultDataEnv;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
          sin_ACK++;
          if (ACK_aux==0) ACK_dup = 0;
          else ACK_dup++;
          if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
          {
            umbralserv = this.serv.vcrep/2;
            if (umbralserv==0)umbralserv=1;
            this.serv.vcrep = 1;
            this.serv.vc = 1;
            this.comprobarEC(this.serv, umbralserv);
            if (this.serv.ec==true) this.serv.flags=ecal;
            else this.serv.flags = al;
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          else
          {
            if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:ACK_dup, NumEnvio:0});
          }
          ultDataEnv = denv;
          this.serv.ult_sn = this.serv.sn;
          this.serv.ult_an = this.serv.an;
          envAck = 1;
          contadorPqtEnv++;
          flag_ACKdup=1;
          ACK_aux =1;
        }
      }
    //COMPROBACIÓN ERROR SEGMENTOS DE MÁS:
    // Si es el penultimo paquete a enviar, sin contar el que se debe reenviar,se prepara para enviar los datos restantes en el último
      if (numPqtServEnv == numPqtServ - 2){ 
        if (pqtPerdido == 1)
            numPqtServEnv += 99;  
       }
    //COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
    // Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
      if (numPqtServEnv == numPqtServ - 1){ 
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
        if (ACK_dup==3) //REENVÍO POR 3 ACKs DUPLICADOS
        {
          this.serv.ec = false;
          umbralserv = Math.round((this.serv.vc/2)*100)/100;
          this.serv.vc=1;
          this.serv.vcrep=1;
          this.serv.ec = false;
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true) this.serv.flags=ecal;
          else this.serv.flags = al;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
          this.serv.vc++;
          this.serv.vcrep++;
          envAck++;
          reconocido = 0;
          ACK_inm = 1;
          sin_ACK = 0;
          ACK_dup = 0;
          pqtPerdido = 0;
        }
        else if (flag_ACKdup==1 && Math.floor (this.serv.vcrep) >= sin_ACK) //ACK DUPLICADO
        {
          timeout--;
          this.cli.flags = ack;
          this.cli.ult_sn = this.cli.sn;
          this.cli.ult_an = this.cli.an;
          let inc: number = this.serv.ult_sn - this.cli.ult_an;
          this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
          ACK_dup++;
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup: ACK_dup, NumEnvio:0});
          envAck = 0; 
          flag_ACKdup = 0;
        }
      else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
      {
        if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
        {
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
        reconocido=0;
        pqtPerdido=0;
        envAck++;
        sin_ACK=0;
        ACK_inm=1;
        }  
        else if (denv !=0) //SEGMENTO BIDIRECCIONAL
        {
        this.cli.ult_sn = this.cli.sn;
        this.cli.ult_an = this.cli.an;
        if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
        envAck++;
        reconocido=0;
        pqtPerdido=0;
        sin_ACK=0;
        ACK_inm=1;
        }
      }
      else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
      {
        timeout--;
        if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
        {
          umbralserv = this.cli.vcrep/2;
          if (umbralserv==0)umbralserv=1;
          this.serv.vcrep=1;
          this.serv.vc=1;
          //this.serv.ec = false;
          //this.serv.flags = nullflag;
          this.comprobarEC(this.serv, umbralserv);
          if (this.serv.ec==true) this.serv.flags=ecal;
          else this.serv.flags = al;
          this.comprobarEC(this.serv, umbralserv);
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
          
        }
        else
        {
          if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
        }
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
      this.comprobarEC(this.serv, umbralserv);
      if (NumEnvios==1)
      {
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: ack, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
      }
      this.serv.ult_sn = this.serv.sn;
      this.serv.ult_an = this.serv.an;
      this.cli.ult_an = this.cli.an;
    }

// ############### SEGUNDO ENVÍO #####################
if (NumEnvios == 2 || NumEnvios == 3)
{
      /*----- ACTUALIZACIÓN DE VARIABLES-----*/
      contadorPqtEnv = 0;  //Indica los pqt enviados (para comparar con los segmentos perdidos)
      timeout = this.simular.timeout;
      ACK_aux = 0;
      x=0;
      y=0;
      // Cliente
      this.cli.data = this.simular.datosclien2;
      this.cli.segperd = this.simular.segperdclien2;
      let numPqtClien: number = Math.floor(this.cli.data / mssClien);
      let numPqtClienEnv: number = 0; //Indica los pqt enviados (para saber cuando terminar)
      let modPqtClien: number = this.cli.data % mssClien;
      let envMaxClien: number = Math.floor(this.serv.w / mssClien);
      var segperdNumclien2 = this.simular.segperdclien2.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico
      //Servidor
      this.serv.data = this.simular.datosserv2;
      this.serv.segperd = this.simular.segperdserv2;
      let numPqtServ: number = Math.floor(this.serv.data / mssServ);
      let numPqtServEnv: number = 0;
      let modPqtServ: number = this.serv.data % mssServ;
      let envMaxServ: number = Math.floor(this.cli.w / mssServ);
      var segperdNumserv2 = this.simular.segperdserv2.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico

   

 // ----------------------------- LADO CLIENTE -----------------------------------------   
 // >>>>> Envio de datos cliente->servidor <<<<<
 if (numPqtClien == 0)
 denv = modPqtClien;
else
 denv = mssClien;

//ENVÍO DE PAQUETES
//############################
numPqtClienEnv++;
if (envAck<2 && ACK_inm==0)envAck=0;
else 
{
  envAck=0;
  ACK_inm=0;
}
for (; numPqtClienEnv <= numPqtClien; numPqtClienEnv++) { 
let x: number=0;
let numenvio: number=0;
if (numPqtClienEnv==1)numenvio=2;
//REENVÍO PAQUETE PERDIDO
if ((this.simular.segperdclien2 != null && timeout==0 && pqtPerdido==1) || (this.simular.segperdclien2 != null && ACK_dup==3 && pqtPerdido==1))
{
 if (this.simular.segperdclien2 != null && timeout==0 && pqtPerdido==1) //SEGMENTO PERDIDO POR FIN DEL TIMEOUT
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   this.cli.vcrep+=1;
   this.cli.vc+=1;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.cli.vcrep+=1;
   this.cli.vc+=1;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }
 }
 else // 3 ACK'S DUPLICADOS
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   umbralcli = Math.round((this.cli.vc / 2)*100)/100;
   this.cli.vc=1;
   this.cli.vcrep=1;
   this.cli.ec = false;
   this.comprobarEC(this.cli, umbralcli);
   if (this.cli.flags==ec) this.cli.flags=ecal;
   else this.cli.flags = al;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   this.cli.vc++;
   this.cli.vcrep++;
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   umbralcli = Math.round((this.cli.vc / 2)*100)/100;
   this.cli.vc=1;
   this.cli.vcrep=1;
   this.cli.ec = false;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   this.comprobarEC(this.cli, umbralcli);
   if (this.cli.flags==ec) this.cli.flags=ecal;
   else this.cli.flags = al;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: al, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   this.cli.vc++;
   this.cli.vcrep++;
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   this.cli.ec = false;
   }
 }
}
 //ACK INMEDIATO
 else if (ACK_inm==1)
 {
   
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
   this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
   this.serv.flags = ack;
   this.incrementarVC(this.cli, this.serv, mssClien);
   this.comprobarEC(this.cli, umbralcli);
   this.serv.ult_an = this.serv.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio });
   numPqtClienEnv--; 
   envAck = 0; 
   ACK_inm=0;
   ACK_dup = 0;
   flag_ACKdup = 0;
   sin_ACK = 0;
 }
 //ACK
 else if (envAck == Math.min(this.cli.vcrep, envMaxClien)||(flag_ACKdup==1 && this.cli.vcrep <= 2) || (flag_ACKdup==1 && Math.floor(this.cli.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
 {
   if (reconocido==0) //ACK NORMAL
   {
     timeout --;
     this.serv.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     let inc: number = this.cli.ult_sn - this.serv.ult_an;
     this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
     this.incrementarVC(this.cli, this.serv, mssClien);
     this.comprobarEC(this.cli, umbralcli);
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
     }
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     numPqtClienEnv--; // HACE QUE EL SEGMENTO PERDIDO SE REPITA DOS VECES!! Solucionado con contadorPqtEnv
     envAck = 0;
   }
   else if (reconocido==1)//ACK DUPLICADO
   {
     timeout --;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     let inc: number = this.cli.ult_sn - this.serv.ult_an;
     this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
     this.serv.flags = ack;
     ACK_dup++;
     if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.cli.flags = nullflag;
       this.cli.ec = false;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     numPqtClienEnv--; 
     envAck = 0; 
     flag_ACKdup = 0;
   }
 }
 //SEGMENTOS PERDIDOS
  // Caso segmento perdido en la dirección cliente -> servidor
 else if (this.simular.segperdclien2!= null && contadorPqtEnv+1==segperdNumclien2[x])
 {
   x++;
   this.cli.flags=nullflag;
   sin_ACK++;
   if (envAck < 2 && denv !=0) // SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
   {
   this.serv.flags= nullflag;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.serv.flags= nullflag;
   this.comprobarEC(this.cli, umbralcli);
   sn_perd = this.cli.sn;
   an_perd = this.cli.an;
   d_perd = denv;
   this.serv.an += ultDataEnv;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   ultDataEnv = denv;
   contadorPqtEnv++;
   numPqtClienEnv--;
   timeout=this.simular.timeout;
   reconocido=1;
   pqtPerdido=1;
   timeout--;
   envAck++;
   }
   else if (denv !=0) // SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
   {
   this.serv.flags = ack;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
   this.incrementarVC(this.cli, this.serv, mssClien);
   this.comprobarEC(this.cli, umbralcli);
   sn_perd = this.cli.sn;
   an_perd = this.cli.an;
   d_perd = denv;
   this.serv.an += ultDataEnv;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
   contadorPqtEnv++;
   numPqtClienEnv--;
   envAck = 1;
   timeout=this.simular.timeout;
   reconocido=1;
   pqtPerdido=1;
   timeout--;
   ACK_aux=1;
 }
 }
 //PAQUETES DE DATOS
 else if (envAck < 2 && denv !=0 && sin_ACK < Math.floor(this.cli.vc) && flag_ACKdup == 0 ) // El numero de paquetes enviados no alcanza al ACK
 {
   let vc_aux: number=0;  
   timeout --;
   this.serv.flags= nullflag;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.comprobarEC(this.cli, umbralcli);
   if (numPqtClienEnv==1)
   {
     this.cli.flags=ack;
     vc_aux=this.cli.vcrep;
   }
   if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   { 
     umbralcli = this.cli.vcrep/2; 
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 , emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     if(pqtPerdido==1) 
     {
       flag_ACKdup=1;
       sin_ACK++;
     }
   }
   this.cli.ult_sn = this.cli.sn;
   ultDataEnv = denv;
   envAck++;
   contadorPqtEnv++;      
 }
 //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 else if (sin_ACK >= Math.floor(this.cli.vc))
 {
   timeout--;
   numPqtClienEnv--;
   if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   { 
     umbralcli = this.cli.vcrep/2; 
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.cli.ec = false;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
 } 
 //ACK Y DATOS 
 else if (denv !=0 || (flag_ACKdup == 1 && this.cli.vcrep >2)){ // Cada 2 paquetes enviados por el cliente, el servidor envia un ACK mientras el cliente envía datos (flechas cruzadas)
   if (reconocido==0) //ACK NORMAL + DATOS
   {  
     timeout--;
     this.serv.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.sn += ultDataEnv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
     this.incrementarVC(this.cli, this.serv, mssServ);
     this.comprobarEC(this.cli, umbralcli);
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     { 
       umbralcli = this.cli.vcrep/2;
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     }
     ultDataEnv = denv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     envAck = 1;
     contadorPqtEnv++;
   }
   else if (reconocido==1) //ACK DUPLICADO + DATOS
   {
     timeout--;
     this.serv.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.sn += ultDataEnv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
     sin_ACK++;
     if (ACK_aux==0) ACK_dup = 0;
     else ACK_dup++;
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     { 
       umbralcli = this.cli.vcrep/2; 
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     ultDataEnv = denv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     envAck = 1;
     contadorPqtEnv++;
     flag_ACKdup=1;
     ACK_aux =1;
   }

 }
//COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
// Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
 if (numPqtClienEnv == numPqtClien - 1){ 
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
  if (ACK_dup==3) //REENVÍO POR 3 ACKs DUPLICADOS
  {
    umbralcli = Math.round((this.cli.vc / 2)*100)/100;
    this.cli.vc=1;
    this.cli.vcrep=1;
    this.cli.ec = false;
    this.comprobarEC(this.cli, umbralcli);
    if (this.cli.flags==ec) this.cli.flags=ecal;
    else this.cli.flags = al;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
    this.cli.vc++;
    this.cli.vcrep++;
    envAck++;
    reconocido=0;
    sin_ACK=0;
    ACK_dup=0;
    ACK_inm = 1;
    pqtPerdido=0;
  }
  else if (flag_ACKdup==1 && Math.floor(this.cli.vcrep) >= sin_ACK) //ACK DUPLICADO
  {
    timeout --;
    this.serv.ult_sn = this.serv.sn;
    this.serv.ult_an = this.serv.an;
    let inc: number = this.cli.ult_sn - this.serv.ult_an;
    this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
    this.serv.flags = ack;
    ACK_dup++;
    if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
    numPqtClienEnv--; 
    envAck = 0; 
    flag_ACKdup = 0;
  }
  else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   this.comprobarEC(this.cli, umbralcli);
   if (this.cli.flags==ec) this.cli.flags=ecal;
   else this.cli.flags = al;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   sin_ACK=0;
   ACK_inm=1;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   sin_ACK=0;
   ACK_inm=1;
   }
 }
 else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 {
   timeout--;
   if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   {
     umbralcli = this.cli.vcrep/2;
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
 }

 }
}

// ----------------------------- LADO SERVIDOR -----------------------------------------
if (envAck==1 && ACK_inm==0)envAck=0;
else 
{
  envAck=0;
  ACK_inm=0;
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
 this.comprobarEC(this.cli, umbralserv);
}

//ACTUALIZACIÓN DE VARIABLES
ACK_aux=0;
ultDataEnv = denv;
envAck = 0;
sin_ACK =0;
numPqtServEnv=0;
contadorPqtEnv= 1;
//ENVÍO DE PAQUETES
for (; numPqtServEnv <= numPqtServ; numPqtServEnv++) {
 //REENVÍO PAQUETE PERDIDO
if ((this.simular.segperdserv2 != null && timeout==0 && pqtPerdido==1 )|| (this.simular.segperdserv2 != null && ACK_dup==3 && pqtPerdido==1))
{
   if (this.simular.segperdserv2 != null && timeout==0 && pqtPerdido==1 ) // REENVÍO POR FIN DEL TIMEOUT
   {
   if (envAck < 2) //SEGMENTO UNIDIRECCIONAL
   {
     this.serv.vcrep+=1;
     this.serv.vc+=1;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
   }
   else    //SEGMENTO BIDIRECCIONAL
   {
     this.serv.vcrep+=1;
     this.serv.vc+=1;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
   }
 }
 else // 3 ACK'S DUPLICADOS
 {
   if (envAck < 2) //SEGMENTO UNIDIRECCIONAL
   {
     this.serv.ec = false;
     umbralserv = Math.round((this.serv.vc/2)*100)/100;
     this.serv.vc=1;
     this.serv.vcrep=1;
     this.serv.ec = false;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.ec==true) this.serv.flags=ecal;
     else this.serv.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     this.serv.vc++;
     this.serv.vcrep++;
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
   }
   else    //SEGMENTO BIDIRECCIONAL
   {
     this.serv.ec=false;
     umbralserv = this.serv.vc/2;
     this.serv.vc=1;
     this.serv.vcrep=1;
     this.serv.ec = false;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: al, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
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
   this.comprobarEC(this.serv, umbralserv);
   this.cli.ult_an = this.cli.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
   numPqtServEnv--;
   envAck = 0;
   ACK_inm = 0;
   ACK_dup = 0;
   sin_ACK = 0;
   flag_ACKdup = 0;
 }
 //ACK
 else if (envAck == Math.min(this.serv.vcrep, envMaxServ)||(flag_ACKdup==1 && this.serv.vcrep <=2)||(flag_ACKdup==1 && Math.floor (this.serv.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
 {
   if (reconocido==0) //ACK NORMAL
   {
     timeout--;
     this.cli.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     let inc: number = this.serv.ult_sn - this.cli.ult_an;
     this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     }
     else 
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     }
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     numPqtServEnv--;
     envAck = 0;
   }
   else if (reconocido==1) //ACK DUPLICADO
   {
     timeout--;
     this.cli.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     let inc: number = this.serv.ult_sn - this.cli.ult_an;
     this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
     ACK_dup++;
     if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup: ACK_dup , NumEnvio:0});
     }
     else 
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup: ACK_dup, NumEnvio:0});
     }
     numPqtServEnv--;
     envAck = 0; 
     flag_ACKdup = 0;
   }
 }
 //SEGMENTOS PERDIDOS
 // Segmento perdido dirección servidor --> cliente
 else if (this.simular.segperdserv2!= null && contadorPqtEnv==segperdNumserv2[y])
 {
   y++;
   this.serv.flags=nullflag;
   sin_ACK++;
   if (envAck < 2) //SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
   {
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.comprobarEC(this.serv, umbralserv);
     sn_perd = this.serv.sn;
     an_perd = this.serv.an;
     d_perd = denv;
     this.cli.an += ultDataEnv;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     this.serv.ult_sn = this.serv.sn;
     ultDataEnv = denv;
     contadorPqtEnv++;
     numPqtServEnv--;
     timeout = this.simular.timeout;
     reconocido = 1;
     pqtPerdido = 1;
     envAck++;
     timeout--;
   }
   else //SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
   {
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     sn_perd = this.serv.sn;
     an_perd = this.serv.an;
     d_perd = denv;
     this.cli.an += ultDataEnv;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -20, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     contadorPqtEnv++;
     numPqtServEnv--;
     timeout = this.simular.timeout;
     reconocido = 1;
     pqtPerdido = 1;
     envAck = 1; 
     timeout--;
     ACK_aux=1;
   }
 }
 //DATOS
 else if (envAck < 2 && sin_ACK < Math.floor(this.serv.vc) && flag_ACKdup == 0) // El numero de paquetes enviados no alcanza al ACK
 {
   timeout--;
   this.cli.flags = nullflag;
   this.serv.ult_sn = this.serv.sn;
   this.serv.sn += ultDataEnv;
   this.comprobarEC(this.serv, umbralserv);
   if (numPqtServEnv==0)this.serv.flags=ack;
   if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   {
     umbralserv = this.cli.vcrep/2;
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep = 1;
     this.serv.vc = 1;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.ec==true) this.serv.flags=ecal;
     else this.serv.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     if(pqtPerdido==1) 
     {
       flag_ACKdup=1;
       sin_ACK++;
     }
   } 
   this.serv.ult_sn = this.serv.sn;
   ultDataEnv = denv;
   envAck++;
   contadorPqtEnv++;
 }
 //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 else if (sin_ACK >= Math.floor(this.serv.vc))
 {
   timeout--;
   numPqtServEnv--;
   if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   { 
     umbralserv = this.serv.vcrep/2; 
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep=1;
     this.serv.vc=1;
     this.serv.ec = false;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.ec==true) this.serv.flags=ecal;
     else this.serv.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
 }
 //ACK Y DATOS
 else if (denv != 0 || (flag_ACKdup == 1 && this.serv.vcrep >2)) { // Cada 2 paquetes enviados por el servidor, el cliente envía ack y el servidor envía datos (flechas cruzadas)
   if (reconocido==0) //ACK NORMAL + DATOS
   {
     timeout--;
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     if (timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     }
     ultDataEnv = denv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     envAck = 1;
     contadorPqtEnv++;
   }
   else if (reconocido == 1) //ACK DUPLICADO + DATOS
   {
     timeout --;
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     sin_ACK++;
     if (ACK_aux==0) ACK_dup = 0;
     else ACK_dup++;
     if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:ACK_dup, NumEnvio:0});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:ACK_dup, NumEnvio:0});
     }
     ultDataEnv = denv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     envAck = 1;
     contadorPqtEnv++;
     flag_ACKdup=1;
     ACK_aux =1;
   }
 }
//COMPROBACIÓN ERROR SEGMENTOS DE MÁS:
// Si es el penultimo paquete a enviar, sin contar el que se debe reenviar,se prepara para enviar los datos restantes en el último
 if (numPqtServEnv == numPqtServ - 2){ 
  if (pqtPerdido == 1)
      numPqtServEnv += 99;  
 }
//COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
// Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
 if (numPqtServEnv == numPqtServ - 1){ 
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
  if (ACK_dup==3) //REENVÍO POR 3 ACKs DUPLICADOS
  {
    this.serv.ec = false;
    umbralserv = Math.round((this.serv.vc/2)*100)/100;
    this.serv.vc=1;
    this.serv.vcrep=1;
    this.serv.ec = false;
    this.comprobarEC(this.serv, umbralserv);
    if (this.serv.ec==true) this.serv.flags=ecal;
    else this.serv.flags = al;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
    this.serv.vc++;
    this.serv.vcrep++;
    envAck++;
    reconocido = 0;
    ACK_inm = 1;
    sin_ACK = 0;
    ACK_dup = 0;
    pqtPerdido = 0;
  }
  else if (flag_ACKdup==1 && Math.floor (this.serv.vcrep) >= sin_ACK) //ACK DUPLICADO
  {
    timeout--;
    this.cli.flags = ack;
    this.cli.ult_sn = this.cli.sn;
    this.cli.ult_an = this.cli.an;
    let inc: number = this.serv.ult_sn - this.cli.ult_an;
    this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
    ACK_dup++;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup: ACK_dup, NumEnvio:0});
    envAck = 0; 
    flag_ACKdup = 0;
  }
else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
   reconocido=0;
   pqtPerdido=0;
   envAck++;
   sin_ACK=0;
   ACK_inm=1;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.cli.ult_sn = this.cli.sn;
   this.cli.ult_an = this.cli.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
   envAck++;
   reconocido=0;
   pqtPerdido=0;
   sin_ACK=0;
   ACK_inm=1;
   }
 }
 else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 {
   timeout--;
   if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   {
     umbralserv = this.cli.vcrep/2;
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep=1;
     this.serv.vc=1;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.ec==true) this.serv.flags=ecal;
     else this.serv.flags = al;
     this.comprobarEC(this.serv, umbralserv);
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
     
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
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
 this.comprobarEC(this.serv, umbralserv);
 if (NumEnvios==2)
 {
 if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: ack, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
 }
 this.serv.ult_sn = this.serv.sn;
 this.serv.ult_an = this.serv.an;
 this.cli.ult_an = this.cli.an;
}
}

// ############### TERCER ENVÍO #####################
if (NumEnvios == 3)
{
      /*-----ACTUALIZACIÓN DE VARIABLES-----*/
      contadorPqtEnv = 0;  //Indica los pqt enviados (para comparar con los segmentos perdidos)
      timeout = this.simular.timeout;
      ACK_aux=0;
      x=0;
      y=0;
      // Cliente
      this.cli.data = this.simular.datosclien3;
      this.cli.segperd = this.simular.segperdclien3;
      let numPqtClien: number = Math.floor(this.cli.data / mssClien);
      let numPqtClienEnv: number = 0; //Indica los pqt enviados (para saber cuando terminar)
      let modPqtClien: number = this.cli.data % mssClien;
      let envMaxClien: number = Math.floor(this.serv.w / mssClien);
      var segperdNumclien3 = this.simular.segperdclien3.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico
      //Servidor
      this.serv.data = this.simular.datosserv3;
      this.serv.segperd = this.simular.segperdserv3;
      let numPqtServ: number = Math.floor(this.serv.data / mssServ);
      let numPqtServEnv: number = 0;
      let modPqtServ: number = this.serv.data % mssServ;
      let envMaxServ: number = Math.floor(this.cli.w / mssServ);
      var segperdNumserv3 = this.simular.segperdserv3.split(',').map(Number); // se transforma la cadena de caracteres a un array numerico

 // ----------------------------- LADO CLIENTE -----------------------------------------   
 // >>>>> Envio de datos cliente->servidor <<<<<
 if (numPqtClien == 0)
 denv = modPqtClien;
else
 denv = mssClien;
//RESTO DE PAQUETES
//############################
numPqtClienEnv++;
if (envAck<2 && ACK_inm==0)envAck=0;
else 
{
  envAck=0;
  ACK_inm=0;
}
for (; numPqtClienEnv <= numPqtClien; numPqtClienEnv++) { 
let x: number=0;
let numenvio: number=0;
if (numPqtClienEnv==1)numenvio=3;
//REENVÍO PAQUETE PERDIDO
if ((this.simular.segperdclien3 != null && timeout==0 && pqtPerdido==1) || (this.simular.segperdclien3 != null && ACK_dup==3 && pqtPerdido==1))
{
 if (this.simular.segperdclien3 != null && timeout==0 && pqtPerdido==1)//REENVÍO POR FIN DEL TEMPORIZADOR 
 {
   if (envAck < 2 && denv !=0 )//SEGMENTO UNIDIRECCIONAL
   {
   this.cli.vcrep+=1;
   this.cli.vc+=1;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.cli.vcrep+=1;
   this.cli.vc+=1;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }
 }
 else // 3 ACK'S DUPLICADOS
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   umbralcli = Math.round((this.cli.vc / 2)*100)/100;
   this.cli.vc=1;
   this.cli.vcrep=1;
   this.cli.ec = false;
   this.comprobarEC(this.cli, umbralcli);
   if (this.cli.flags==ec) this.cli.flags=ecal;
   else this.cli.flags = al;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   this.cli.vc++;
   this.cli.vcrep++;
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   umbralcli = Math.round((this.cli.vc / 2)*100)/100;
   this.cli.vc=1;
   this.cli.vcrep=1;
   this.cli.ec = false;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   this.comprobarEC(this.cli, umbralcli);
   if (this.cli.flags==ec) this.cli.flags=ecal;
   else this.cli.flags = al;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: al, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   this.cli.vc++;
   this.cli.vcrep++;
   envAck++;
   reconocido=0;
   ACK_inm = 1;
   pqtPerdido=0;
   this.cli.ec = false;
   }
 }
}
 //ACK INMEDIATO
 else if (ACK_inm==1)
 {
   
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   let inc: number = Math.abs(this.cli.ult_sn - this.serv.ult_an);
   this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
   this.serv.flags = ack;
   this.incrementarVC(this.cli, this.serv, mssClien);
   this.comprobarEC(this.cli, umbralcli);
   this.serv.ult_an = this.serv.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0 });
   numPqtClienEnv--; // HACE QUE EL SEGMENTO PERDIDO SE REPITA DOS VECES!! Solucionado con contadorPqtEnv
   envAck = 0; 
   ACK_inm=0;
   ACK_dup = 0;
   flag_ACKdup = 0;
   sin_ACK = 0;
 }
 //ACK
 else if (envAck == Math.min(this.cli.vcrep, envMaxClien)||(flag_ACKdup==1 && this.cli.vcrep <= 2) || (flag_ACKdup==1 && Math.floor(this.cli.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
 {
   if (reconocido==0) //ACK NORMAL
   {
     timeout --;
     this.serv.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     let inc: number = this.cli.ult_sn - this.serv.ult_an;
     this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
     this.incrementarVC(this.cli, this.serv, mssClien);
     this.comprobarEC(this.cli, umbralcli);
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralcli = Math.round((this.cli.vcrep/2)*100)/100; 
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
     }
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     numPqtClienEnv--; 
     envAck = 0;
   }
   else if (reconocido==1)//ACK DUPLICADO
   {
     timeout --;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     let inc: number = this.cli.ult_sn - this.serv.ult_an;
     this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
     this.serv.flags = ack;
     ACK_dup++;
     if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralcli = Math.round((this.cli.vcrep/2)*100)/100;
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.cli.flags = nullflag;
       this.cli.ec = false;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     numPqtClienEnv--;
     envAck = 0; 
     flag_ACKdup = 0;
   }
 }
 //SEGMENTOS PERDIDOS
 // Caso segmento perdido en la dirección cliente -> servidor
 else if (this.simular.segperdclien3!= null && contadorPqtEnv+1==segperdNumclien3[x])
 {
   x++;
   this.cli.flags=nullflag;
   sin_ACK++;
   if (envAck < 2 && denv !=0) //SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
   {
   this.serv.flags= nullflag;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.serv.flags= nullflag;
   this.comprobarEC(this.cli, umbralcli);
   sn_perd = this.cli.sn;
   an_perd = this.cli.an;
   d_perd = denv;
   this.serv.an += ultDataEnv;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   ultDataEnv = denv;
   contadorPqtEnv++;
   numPqtClienEnv--;
   timeout=this.simular.timeout;
   reconocido=1;
   pqtPerdido=1;
   timeout--;
   envAck++;
   }
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
   {
   this.serv.flags = ack;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
   this.incrementarVC(this.cli, this.serv, mssClien);
   this.comprobarEC(this.cli, umbralcli);
   sn_perd = this.cli.sn;
   an_perd = this.cli.an;
   d_perd = denv;
   this.serv.an += ultDataEnv;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0 , Num_ACKdup:0, NumEnvio:numenvio});
   contadorPqtEnv++;
   numPqtClienEnv--;
   envAck = 1;
   timeout=this.simular.timeout;
   reconocido=1;
   pqtPerdido=1;
   timeout--;
   ACK_aux=1;
 }
 }
 //PAQUETES DE DATOS
 else if (envAck < 2 && denv !=0 && sin_ACK < Math.floor(this.cli.vc) && flag_ACKdup == 0 ) // El numero de paquetes enviados no alcanza al ACK
 {
   timeout --;
   let vc_aux: number=0;
   this.serv.flags= nullflag;
   this.cli.ult_sn = this.cli.sn;
   this.cli.sn += ultDataEnv;
   this.comprobarEC(this.cli, umbralcli);
   if (numPqtClienEnv==1)
   {
     this.cli.flags=ack;
     vc_aux=this.cli.vcrep;
   }
   if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
   { 
     umbralcli = this.cli.vcrep/2; 
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 , emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     if(pqtPerdido==1) 
     {
       flag_ACKdup=1;
       sin_ACK++;
     }
   }
   this.cli.ult_sn = this.cli.sn;
   ultDataEnv = denv;
   envAck++;
   contadorPqtEnv++;      
 }
 //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 else if (sin_ACK >= Math.floor(this.cli.vc))
 {
   timeout--;
   numPqtClienEnv--;
   if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
   { 
     umbralcli = this.cli.vcrep/2; 
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.cli.ec = false;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
 } 
 //ACK Y DATOS 
 else if (denv !=0 || (flag_ACKdup == 1 && this.cli.vcrep >2)){ // Cada 2 paquetes enviados por el cliente, el servidor envia un ACK mientras el cliente envía datos (flechas cruzadas)
   if (reconocido==0) //ACK NORMAL + DATOS
   {  
     timeout--;
     this.serv.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.sn += ultDataEnv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
     this.incrementarVC(this.cli, this.serv, mssServ);
     this.comprobarEC(this.cli, umbralcli);
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
     { 
       umbralcli = this.cli.vcrep/2;
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       this.comprobarEC(this.cli, umbralcli);
       if (this.cli.flags==ec) this.cli.flags=ecal;
       else this.cli.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.cli.sn, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: this.cli.vcrep, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:numenvio});
     }
     ultDataEnv = denv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     envAck = 1;
     contadorPqtEnv++;
   }
   else if (reconocido==1) //ACK DUPLICADO + DATOS
   {
     timeout--;
     this.serv.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.sn += ultDataEnv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     this.serv.an = this.cli.ult_sn + (this.cli.ult_sn - this.serv.ult_an);
     sin_ACK++;
     if (ACK_aux==0) ACK_dup = 0;
     else ACK_dup++;
     if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TIMEOUT
     { 
       umbralcli = this.cli.vcrep/2; 
       if (umbralcli==0)umbralcli=1;
       this.cli.vcrep=1;
       this.cli.vc=1;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)  this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: denv, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:0, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:numenvio});
     }
     ultDataEnv = denv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     envAck = 1;
     contadorPqtEnv++;
     flag_ACKdup=1;
     ACK_aux =1;
   }

 }
//COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
// Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
 if (numPqtClienEnv == numPqtClien - 1){ 
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
  if (ACK_dup==3) //REENVÍO POR 3 ACKs DUPLICADOS
  {
    umbralcli = Math.round((this.cli.vc / 2)*100)/100;
    this.cli.vc=1;
    this.cli.vcrep=1;
    this.cli.ec = false;
    this.comprobarEC(this.cli, umbralcli);
    if (this.cli.flags==ec) this.cli.flags=ecal;
    else this.cli.flags = al;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:1 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
    this.cli.vc++;
    this.cli.vcrep++;
    envAck++;
    reconocido=0;
    sin_ACK=0;
    ACK_dup=0;
    ACK_inm = 1;
    pqtPerdido=0;
  }
  else if (flag_ACKdup==1 && Math.floor(this.cli.vcrep) >= sin_ACK) //ACK DUPLICADO
  {
    timeout --;
    this.serv.ult_sn = this.serv.sn;
    this.serv.ult_an = this.serv.an;
    let inc: number = this.cli.ult_sn - this.serv.ult_an;
    this.serv.an = this.cli.ult_sn + (inc == 0 ? denv : inc);
    this.serv.flags = ack;
    ACK_dup++;
    if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: sn_perd, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:ACK_dup, NumEnvio:0});
    numPqtClienEnv--; // HACE QUE EL SEGMENTO PERDIDO SE REPITA DOS VECES!! Solucionado con contadorPqtEnv
    envAck = 0; 
    flag_ACKdup = 0;
  }
  else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   this.comprobarEC(this.cli, umbralcli);
   if (this.cli.flags==ec) this.cli.flags=ecal;
   else this.cli.flags = al;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   reconocido=0;
   pqtPerdido=0;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.serv.ult_sn = this.serv.sn;
   this.serv.ult_an = this.serv.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 0, flagcli: nullflag, sncli: sn_perd, ancli: an_perd, dcli: d_perd, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   envAck++;
   reconocido=0;
   pqtPerdido=0;
   }
 }
 else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 {
   timeout--;
   if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   {
     umbralcli = this.cli.vcrep/2;
     if (umbralcli==0)umbralcli=1;
     this.cli.vcrep=1;
     this.cli.vc=1;
     this.comprobarEC(this.cli, umbralcli);
     if (this.cli.flags==ec) this.cli.flags=ecal;
     else this.cli.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.cli.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralcli, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
 }

 }
}

// ----------------------------- LADO SERVIDOR -----------------------------------------

if (envAck==1) envAck=0;
else envAck=0;
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
 this.comprobarEC(this.cli, umbralserv);
}
ACK_aux=0;
ultDataEnv = denv; 
envAck = 0;
sin_ACK =0;
numPqtServEnv=0;
contadorPqtEnv= 1;
//ENVÍO DE PAQUETES
for (; numPqtServEnv <= numPqtServ; numPqtServEnv++) {
 //REENVÍO PAQUETE PERDIDO
if ((this.simular.segperdserv3 != null && timeout==0 && pqtPerdido==1 )|| (this.simular.segperdserv3 != null && ACK_dup==3 && pqtPerdido==1))
{
   if (this.simular.segperdserv3 != null && timeout==0 && pqtPerdido==1 ) //REENVÍO POR FIN DEL TIMEOUT
   {
   if (envAck < 2) //SEGMENTO UNIDIRECCIONAL
   {
     this.serv.vcrep+=1;
     this.serv.vc+=1;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
   }
   else    //SEGMENTO BIDIRECCIONAL
   {
     this.serv.vcrep+=1;
     this.serv.vc+=1;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
   }
 }
 else // 3 ACK'S DUPLICADOS
 {
   if (envAck < 2) //SEGMENTO UNIDIRECCIONAL
   {
     this.serv.ec = false;
     umbralserv = Math.round((this.serv.vc/2)*100)/100;
     this.serv.vc=1;
     this.serv.vcrep=1;
     this.serv.ec = false;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.ec==true) this.serv.flags=ecal;
     else this.serv.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     this.serv.vc++;
     this.serv.vcrep++;
     envAck++;
     reconocido = 0;
     ACK_inm = 1;
     pqtPerdido = 0;
   }
   else    //SEGMENTO BIDIRECCIONAL
   {
     this.serv.ec=false;
     umbralserv = this.serv.vc/2;
     this.serv.vc=1;
     this.serv.vcrep=1;
     this.serv.ec = false;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: al, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
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
   this.comprobarEC(this.serv, umbralserv);
   this.cli.ult_an = this.cli.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
   numPqtServEnv--;
   envAck = 0;
   ACK_inm = 0;
   ACK_dup = 0;
   sin_ACK = 0;
   flag_ACKdup = 0;
 }
 //ACK
 else if (envAck == Math.min(this.serv.vcrep, envMaxServ)||(flag_ACKdup==1 && this.serv.vcrep <=2)||(flag_ACKdup==1 && Math.floor (this.serv.vcrep) == sin_ACK)) // Si se han enviado los paquetes que permite la VC pero no se ha recibido aun un ACK, se envia
 {
   if (reconocido==0) //ACK NORMAL
   {
     timeout--;
     this.cli.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     let inc: number = this.serv.ult_sn - this.cli.ult_an;
     this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     }
     else 
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     }
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     numPqtServEnv--;
     envAck = 0;
   }
   else if (reconocido==1) //ACK DUPLICADO
   {
     timeout--;
     this.cli.flags = ack;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     let inc: number = this.serv.ult_sn - this.cli.ult_an;
     this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
     ACK_dup++;
     if(timeout==0 && pqtPerdido==1)//SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup: ACK_dup , NumEnvio:0});
     }
     else 
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup: ACK_dup, NumEnvio:0});
     }
     numPqtServEnv--;
     envAck = 0; 
     flag_ACKdup = 0;
   }
 }
 //SEGMENTOS PERDIDOS
 // Segmento perdido dirección servidor --> cliente
 else if (this.simular.segperdserv3!= null && contadorPqtEnv==segperdNumserv3[y])
 {
   y++;
   this.serv.flags=nullflag;
   sin_ACK++;
   if (envAck < 2) //SEGMENTO UNIDIRECCIONAL (SEGMENTO PERDIDO)
   {
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.comprobarEC(this.serv, umbralserv);
     sn_perd = this.serv.sn;
     an_perd = this.serv.an;
     d_perd = denv;
     this.cli.an += ultDataEnv;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     this.serv.ult_sn = this.serv.sn;
     ultDataEnv = denv;
     contadorPqtEnv++;
     numPqtServEnv--;
     timeout = this.simular.timeout;
     reconocido = 1;
     pqtPerdido = 1;
     timeout--;
     envAck++;
   }
   else  //SEGMENTO BIDIRECCIONAL (SEGMENTO PERDIDO)
   {
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     sn_perd = this.serv.sn;
     an_perd = this.serv.an;
     d_perd = denv;
     this.cli.an += ultDataEnv;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: -20, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     contadorPqtEnv++;
     numPqtServEnv--;
     timeout = this.simular.timeout;
     reconocido = 1;
     pqtPerdido = 1;
     envAck = 1; 
     timeout--;
     ACK_aux=1;
   }
 }
 //DATOS
 else if (envAck < 2 && sin_ACK < Math.floor(this.serv.vc) && flag_ACKdup == 0) // El numero de paquetes enviados no alcanza al ACK
 {
   timeout--;
   this.cli.flags = nullflag;
   this.serv.ult_sn = this.serv.sn;
   this.serv.sn += ultDataEnv;
   this.comprobarEC(this.serv, umbralserv);
   if (numPqtServEnv==0)this.serv.flags=ack;
   if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   {
     umbralserv = this.cli.vcrep/2;
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep = 1;
     this.serv.vc = 1;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.flags== ec) this.serv.flags=ecal;
     else this.serv.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     if(pqtPerdido==1) 
     {
       flag_ACKdup=1;
       sin_ACK++;
     }
   } 
   this.serv.ult_sn = this.serv.sn;
   ultDataEnv = denv;
   envAck++;
   contadorPqtEnv++;
 }
 //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 else if (sin_ACK >= Math.floor(this.serv.vc))
 {
   timeout--;
   numPqtServEnv--;
   if(timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   { 
     umbralserv = this.serv.vcrep/2; 
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep=1;
     this.serv.vc=1;
     this.serv.ec = false;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.ec==true) this.serv.flags=ecal;
     else this.serv.flags = al;
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0 ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
 }
 //ACK Y DATOS
 else if (denv != 0 || (flag_ACKdup == 1 && this.serv.vcrep >2)) { // Cada 2 paquetes enviados por el servidor, el cliente envía ack y el servidor envía datos (flechas cruzadas)
   if (reconocido==0) //ACK NORMAL + DATOS
   {
     timeout--;
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     this.incrementarVC(this.serv, this.cli, mssServ);
     this.comprobarEC(this.serv, umbralserv);
     if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0) this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.serv.sn, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
     }
     ultDataEnv = denv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     envAck = 1;
     contadorPqtEnv++;
   }
   else if (reconocido == 1) //ACK DUPLICADO + DATOS
   {
     timeout --;
     this.cli.flags = ack;
     this.serv.ult_sn = this.serv.sn;
     this.serv.sn += ultDataEnv;
     this.cli.ult_sn = this.cli.sn;
     this.cli.ult_an = this.cli.an;
     this.cli.an = this.serv.ult_sn + (this.serv.ult_sn - this.cli.ult_an);
     sin_ACK++;
     if (ACK_aux==0) ACK_dup = 0;
     else ACK_dup++;
     if (timeout==0 && pqtPerdido==1) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
     {
       umbralserv = this.serv.vcrep/2;
       if (umbralserv==0)umbralserv=1;
       this.serv.vcrep = 1;
       this.serv.vc = 1;
       this.comprobarEC(this.serv, umbralserv);
       if (this.serv.ec==true) this.serv.flags=ecal;
       else this.serv.flags = al;
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:1,umbral:umbralserv, envio:1 , Num_ACKdup:ACK_dup, NumEnvio:0});
     }
     else
     {
       if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: denv, wserv: this.serv.w, mssserv: 0, vc: 0,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:ACK_dup, NumEnvio:0});
     }
     ultDataEnv = denv;
     this.serv.ult_sn = this.serv.sn;
     this.serv.ult_an = this.serv.an;
     envAck = 1;
     contadorPqtEnv++;
     flag_ACKdup=1;
     ACK_aux =1;
   }
 }
//COMPROBACIÓN ERROR SEGMENTOS DE MÁS:
// Si es el penultimo paquete a enviar, sin contar el que se debe reenviar,se prepara para enviar los datos restantes en el último
 if (numPqtServEnv == numPqtServ - 2){ 
  if (pqtPerdido == 1)
      numPqtServEnv += 99;  
 }
//COMPROBACIÓN ERROR SEGMENTO SIN DATOS:
// Si es el penultimo paquete a enviar, se prepara para enviar los datos restantes en el último
 if (numPqtServEnv == numPqtServ - 1){ 
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
  if (ACK_dup==3) //REENVÍO POR 3 ACKs DUPLICADOS
  {
    this.serv.ec = false;
    umbralserv = Math.round((this.serv.vc/2)*100)/100;
    this.serv.vc=1;
    this.serv.vcrep=1;
    this.serv.ec = false;
    this.comprobarEC(this.serv, umbralserv);
    if (this.serv.ec==true) this.serv.flags=ecal;
    else this.serv.flags = al;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep, emisor:2, pqt_rtx:1, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
    this.serv.vc++;
    this.serv.vcrep++;
    envAck++;
    reconocido = 0;
    ACK_inm = 1;
    sin_ACK = 0;
    ACK_dup = 0;
    pqtPerdido = 0;
  }
  else if (flag_ACKdup==1 && Math.floor (this.serv.vcrep) >= sin_ACK) //ACK DUPLICADO
  {
    timeout--;
    this.cli.flags = ack;
    this.cli.ult_sn = this.cli.sn;
    this.cli.ult_an = this.cli.an;
    let inc: number = this.serv.ult_sn - this.cli.ult_an;
    this.cli.an = this.serv.ult_sn + (inc == 0 ? denv : inc);
    ACK_dup++;
    if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: sn_perd, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup: ACK_dup, NumEnvio:0});
    envAck = 0; 
    flag_ACKdup = 0;
  }
else if (timeout==0)//REENVÍO DEL PAQUETE POR FIN DEL TEMPORIZADOR
 {
   if (envAck < 2 && denv !=0 ) //SEGMENTO UNIDIRECCIONAL
   {
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: this.cli.flags, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
   reconocido=0;
   pqtPerdido=0;
   envAck++;
   }  
   else if (denv !=0) //SEGMENTO BIDIRECCIONAL
   {
   this.cli.ult_sn = this.cli.sn;
   this.cli.ult_an = this.cli.an;
   if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 10, flagcli: this.cli.flags, sncli: sn_perd, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: sn_perd, anserv: an_perd, dserv: d_perd, wserv: this.serv.w, mssserv: 0, vc: this.serv.vcrep,emisor:0, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0 , NumEnvio:0});
   envAck++;
   reconocido=0;
   pqtPerdido=0;
   }
 }
 else //SEGMENTO VACÍO (Esperando a que caduque el temporizador)
 {
   timeout--;
   if (timeout==0) //SEGMENTO ANTERIOR AL REENVÍO POR FIN DEL TEMPORIZADOR
   {
     umbralserv = this.cli.vcrep/2;
     if (umbralserv==0)umbralserv=1;
     this.serv.vcrep=1;
     this.serv.vc=1;
     this.comprobarEC(this.serv, umbralserv);
     if (this.serv.flags==ec) this.serv.flags=ecal;
     else this.serv.flags = al;
     this.comprobarEC(this.serv, umbralserv);
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep, emisor:1, pqt_rtx:0 , fin_temp:1,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});   
   }
   else
   {
     if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0, emisor:1, pqt_rtx:0 , fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
   }
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
 this.comprobarEC(this.serv, umbralserv);
 if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: ack, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: this.serv.flags, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: this.serv.vcrep ,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
 this.serv.ult_sn = this.serv.sn;
 this.serv.ult_an = this.serv.an;
 this.cli.ult_an = this.cli.an;
}
}  
    // El cliente espera 1 tick por si hay intercambio de informacion y luego se procede a cerrar
    if (envAck == 2 && cierre == "1")
    { 
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: null, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
    }

    // ----- CIERRE -----
    // Enviamos los segmentos de FIN; FIN, ACK; y ACK
    if (cierre == "1") { // El cliente cierra la conexion
      //FIN
      this.cli.ult_sn = this.cli.sn;
      this.cli.flags = fin;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0 , Num_ACKdup:0, NumEnvio:0});
      // FIN, ACK
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += denv;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + 1;
      this.serv.flags = finack;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0 ,emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0, Num_ACKdup:0, NumEnvio:0});
      // ACK
      this.cli.ult_sn = this.cli.sn;
      this.cli.sn++;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + 1;
      this.cli.flags = ack;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:0 , Num_ACKdup:0, NumEnvio:0});

    } else { // El servidor cierra la conexion
      // FIN
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn += denv;
      this.serv.ult_an = this.serv.an;
      this.serv.flags = fin;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
      // FIN, ACK
      this.cli.ult_sn = this.cli.sn;
      this.cli.ult_an = this.cli.an;
      this.cli.an = this.serv.sn + 1;
      this.cli.flags = finack;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 1, flagcli: this.cli.flags, sncli: this.cli.sn, ancli: this.cli.an, dcli: 0, wcli: this.cli.w, msscli: 0, flagserv: nullflag, snserv: 0, anserv: 0, dserv: 0, wserv: 0, mssserv: 0, vc: 0,emisor:1, pqt_rtx:0, fin_temp:0,umbral:umbralserv, envio:1 , Num_ACKdup:0, NumEnvio:0});
      // ACK
      this.serv.ult_sn = this.serv.sn;
      this.serv.sn++;
      this.serv.ult_an = this.serv.an;
      this.serv.an = this.cli.sn + 1;
      this.serv.flags = ack;
      if (nseg+1<=pasoapaso || pasoapaso==0)this.comunicacion.push({ numseg: ++nseg, dir: 2, flagcli: nullflag, sncli: 0, ancli: 0, dcli: 0, wcli: 0, msscli: 0, flagserv: this.serv.flags, snserv: this.serv.sn, anserv: this.serv.an, dserv: 0, wserv: this.serv.w, mssserv: 0, vc: 0, emisor:2, pqt_rtx:0, fin_temp:0 ,umbral:umbralserv, envio:1, Num_ACKdup:0, NumEnvio:0});
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
