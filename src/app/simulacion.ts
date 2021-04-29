// Clase que tiene lo parametros para hacer la simulacion
export class Simulacion {
    //Cliente
    ipclien: string;
    mssclien: number;
    datosclien: number;
    datosclien2: number;
    datosclien3: number;
    snclien: number;
    segperdclien: string;
    segperdclien2: string;
    segperdclien3: string;
    wclien: number;
    //Servidor
    ipserv: string;
    mssserv: number;
    datosserv: number;
    datosserv2: number;
    datosserv3: number;
    snserv: number;
    segperdserv: string;
    segperdserv2: string;
    segperdserv3: string;
    wserv: number;
    //General
    timeout: number;
    umbral: number;
    algort: string;
    cierre: string;
    pasoapaso:number;
    envios:number;
}