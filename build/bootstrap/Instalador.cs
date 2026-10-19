using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("Instalador de Victoria Kingdom")]
[assembly: AssemblyDescription("Consulta e instala la última versión estable del launcher oficial.")]
[assembly: AssemblyCompany("Victoria Kingdom")]
[assembly: AssemblyProduct("Victoria Kingdom Setup")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace Victoria.Instalador {
 sealed class VersionPublicada {
  public string Version, Url, Sha256; public long Tamano;
  const string Raiz="https://github.com/FalconKing574/victoria-launcher/releases/download/";
  static readonly JavaScriptSerializer Json=new JavaScriptSerializer {MaxJsonLength=2*1024*1024};
  static string Texto(IDictionary<string,object> d,string clave) { object v; return d.TryGetValue(clave,out v)&&v is string?(string)v:""; }
  static long Numero(IDictionary<string,object> d,string clave) { object v; if(!d.TryGetValue(clave,out v)||!(v is int||v is long||v is decimal))throw new InvalidDataException("Tamaño no válido."); return Convert.ToInt64(v); }
  public static VersionPublicada Leer(string texto,bool github) {
   var d=Json.Deserialize<Dictionary<string,object>>(texto); if(d==null)throw new InvalidDataException("Metadatos vacíos.");
   VersionPublicada v=new VersionPublicada();
   if(github) {
    object draft,pre; if(!d.TryGetValue("draft",out draft)||!false.Equals(draft)||!d.TryGetValue("prerelease",out pre)||!false.Equals(pre))throw new InvalidDataException("La publicación no es estable.");
    string tag=Texto(d,"tag_name");if(!Regex.IsMatch(tag,@"^v\d+\.\d+\.\d+$"))throw new InvalidDataException("Versión no válida.");v.Version=tag.Substring(1);
    object assets;if(!d.TryGetValue("assets",out assets)||!(assets is IEnumerable))throw new InvalidDataException("Falta el instalador.");
    foreach(object a in (IEnumerable)assets){var asset=a as Dictionary<string,object>;if(asset!=null&&Texto(asset,"name")=="Victoria-Kingdom-actualizacion-"+v.Version+".exe") {v.Url=Texto(asset,"browser_download_url");string hash=Texto(asset,"digest");if(!hash.StartsWith("sha256:"))throw new InvalidDataException("Falta la comprobación SHA256.");v.Sha256=hash.Substring(7);v.Tamano=Numero(asset,"size");break;}}
   } else { v.Version=Texto(d,"version");v.Url=Texto(d,"url");v.Sha256=Texto(d,"sha256");v.Tamano=Numero(d,"size"); }
   if(!Regex.IsMatch(v.Version??"",@"^\d+\.\d+\.\d+$")||v.Url!=Raiz+"v"+v.Version+"/Victoria-Kingdom-actualizacion-"+v.Version+".exe"||!Regex.IsMatch(v.Sha256??"",@"\A[a-fA-F0-9]{64}\z")||v.Tamano<1000000||v.Tamano>536870912)throw new InvalidDataException("La publicación no tiene un instalador oficial verificable.");
   v.Sha256=v.Sha256.ToLowerInvariant();return v;
  }
 }
 sealed class Descargador {
  public volatile bool Cancelado; volatile HttpWebRequest Actual;
  public void Cancelar(){Cancelado=true;var r=Actual;if(r!=null)r.Abort();}
  public void RevisarCancelacion(){if(Cancelado)throw new OperationCanceledException();}
  HttpWebRequest Solicitud(string url) {
   RevisarCancelacion();var r=(HttpWebRequest)WebRequest.Create(url);r.Timeout=15000;r.ReadWriteTimeout=20000;r.UserAgent="Victoria-Kingdom-Installer/1.0";r.Accept="application/json";r.AutomaticDecompression=DecompressionMethods.GZip|DecompressionMethods.Deflate;Actual=r;return r;
  }
  string Metadatos(string url){using(var r=(HttpWebResponse)Solicitud(url).GetResponse()){if(r.StatusCode!=HttpStatusCode.OK)throw new WebException();using(var s=r.GetResponseStream())using(var mem=new MemoryStream()){var b=new byte[8192];int n;while((n=s.Read(b,0,b.Length))>0){RevisarCancelacion();if(mem.Length+n>2*1024*1024)throw new InvalidDataException("Respuesta demasiado grande.");mem.Write(b,0,n);}return Encoding.UTF8.GetString(mem.ToArray());}}}
  public VersionPublicada Ultima() {
   string fresco=DateTime.UtcNow.Ticks.ToString();
   try{return VersionPublicada.Leer(Metadatos("https://api.github.com/repos/FalconKing574/victoria-launcher/releases/latest?comprobar="+fresco),true);}
   catch(OperationCanceledException){throw;}
   catch {RevisarCancelacion();return VersionPublicada.Leer(Metadatos("https://victoriakingdom.pages.dev/api/launcher?actual=1&comprobar="+fresco),false);}
  }
  public void Descargar(VersionPublicada v,string archivo,Action<int,string> progreso) {
   using(var r=(HttpWebResponse)Solicitud(v.Url).GetResponse()) {
    if(r.StatusCode!=HttpStatusCode.OK)throw new WebException();
    using(var s=r.GetResponseStream())using(var f=new FileStream(archivo,FileMode.CreateNew,FileAccess.Write,FileShare.None)) {
     byte[] b=new byte[65536];long total=0;int n,ultimo=-1;
     while((n=s.Read(b,0,b.Length))>0){RevisarCancelacion();total+=n;if(total>v.Tamano)throw new InvalidDataException("El tamaño del instalador no coincide.");f.Write(b,0,n);int p=(int)(total*100/v.Tamano);if(p!=ultimo){ultimo=p;progreso(p,"Descargando launcher "+v.Version+" · "+(total/1048576)+" / "+(v.Tamano/1048576)+" MB");}}
     if(total!=v.Tamano)throw new InvalidDataException("La descarga quedó incompleta.");
    }
   }
   progreso(100,"Comprobando integridad del instalador…");RevisarCancelacion();
   string hash;using(var sha=SHA256.Create())using(var f=File.OpenRead(archivo))hash=BitConverter.ToString(sha.ComputeHash(f)).Replace("-","").ToLowerInvariant();
   if(hash!=v.Sha256)throw new InvalidDataException("La verificación SHA256 falló. No se ejecutó el archivo.");
  }
  public VersionPublicada Preparar(string carpeta,Action<int,string> progreso) {
   for(int intento=0;intento<3;intento++){
    progreso(0,"Buscando la última versión estable…");var v=Ultima();string archivo=Path.Combine(carpeta,"launcher-"+Guid.NewGuid().ToString("N")+".exe");
    Descargar(v,archivo,progreso);RevisarCancelacion();progreso(100,"Confirmando que sigue siendo la última versión…");var actual=Ultima();
    if(actual.Version==v.Version&&actual.Sha256==v.Sha256){ArchivoListo=archivo;return v;}File.Delete(archivo);
   }
   throw new InvalidDataException("La versión cambió durante la descarga. Vuelve a intentarlo en unos minutos.");
  }
  public string ArchivoListo;
 }
 sealed class Ventana : Form {
  readonly Label estado=new Label();readonly ProgressBar progreso=new ProgressBar();readonly Button instalar=new Button(),cancelar=new Button();readonly BackgroundWorker trabajo=new BackgroundWorker();Descargador descarga;bool ejecutando,instalando;
  public Ventana() {
   Text="Instalar Victoria Kingdom";ClientSize=new Size(520,300);StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;BackColor=Color.FromArgb(20,22,28);ForeColor=Color.White;Font=new Font("Segoe UI",10);AutoScaleMode=AutoScaleMode.Dpi;
   try{Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);}catch{}
   var titulo=new Label {Text="VICTORIA KINGDOM",Font=new Font("Segoe UI",20,FontStyle.Bold),ForeColor=Color.FromArgb(225,191,99),AutoSize=false,Location=new Point(28,24),Size=new Size(470,40)};
   var texto=new Label {Text="Instala la última versión del launcher oficial.\nSe consultará la versión disponible al pulsar Instalar.",Location=new Point(30,80),Size=new Size(460,48)};
   estado.Text="Necesitas conexión a Internet. No se requieren permisos de administrador.";estado.Location=new Point(30,143);estado.Size=new Size(460,42);estado.ForeColor=Color.FromArgb(190,195,205);
   progreso.Location=new Point(30,195);progreso.Size=new Size(460,10);
   instalar.Text="Instalar última versión";instalar.Location=new Point(250,230);instalar.Size=new Size(240,40);instalar.FlatStyle=FlatStyle.Flat;instalar.BackColor=Color.FromArgb(178,35,52);
   cancelar.Text="Cancelar";cancelar.Location=new Point(30,230);cancelar.Size=new Size(150,40);cancelar.FlatStyle=FlatStyle.Flat;
   Controls.AddRange(new Control[]{titulo,texto,estado,progreso,instalar,cancelar});AcceptButton=instalar;CancelButton=cancelar;
   instalar.Click+=(s,e)=>Empezar();cancelar.Click+=(s,e)=>{if(instalando)return;if(ejecutando){descarga.Cancelar();cancelar.Enabled=false;estado.Text="Cancelando descarga…";}else Close();};
   FormClosing+=(s,e)=>{if(ejecutando){e.Cancel=true;if(!instalando){descarga.Cancelar();estado.Text="Cancelando descarga…";}}};
   trabajo.WorkerReportsProgress=true;trabajo.ProgressChanged+=(s,e)=>{progreso.Value=Math.Max(0,Math.Min(100,e.ProgressPercentage));estado.Text=(string)e.UserState;};
   trabajo.DoWork+=(s,e)=>{string carpeta=Path.Combine(Path.GetTempPath(),"Victoria-Instalador-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(carpeta);try{var v=descarga.Preparar(carpeta,(p,t)=>trabajo.ReportProgress(p,t));descarga.RevisarCancelacion();instalando=true;trabajo.ReportProgress(100,"Abriendo el asistente de instalación "+v.Version+"…");using(var p=Process.Start(new ProcessStartInfo(descarga.ArchivoListo){UseShellExecute=false})){p.WaitForExit();if(p.ExitCode!=0&&p.ExitCode!=3010)throw new InvalidOperationException("La instalación fue cancelada o no terminó correctamente.");}e.Result=v.Version;}finally{instalando=false;Programa.LimpiarTemporal(carpeta);}};
   trabajo.RunWorkerCompleted+=(s,e)=>{ejecutando=false;instalar.Enabled=true;cancelar.Enabled=true;if(e.Error!=null){instalar.Text="Reintentar";if(descarga.Cancelado){estado.Text="Descarga cancelada. No se instaló nada.";return;}estado.Text="No se pudo instalar. Revisa tu conexión y vuelve a intentarlo.";MessageBox.Show(this,e.Error is InvalidDataException||e.Error is InvalidOperationException?e.Error.Message:"No se pudo conectar con el servicio de descargas. Revisa la conexión del instalador, el proxy o el firewall. Si continúa, abre un ticket en el Discord de Victoria.","Instalación pendiente",MessageBoxButtons.OK,MessageBoxIcon.Information);}else{estado.Text="Launcher "+e.Result+" instalado correctamente.";instalar.Enabled=false;cancelar.Text="Cerrar";}};
  }
  void Empezar(){if(ejecutando)return;ejecutando=true;descarga=new Descargador();instalar.Enabled=false;cancelar.Enabled=true;progreso.Value=0;trabajo.RunWorkerAsync();}
 }
 static class Programa {
  public static void LimpiarTemporal(string carpeta) {
   if(carpeta==null)return;string destino=Path.GetFullPath(carpeta),raiz=Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
   if(!destino.StartsWith(raiz,StringComparison.OrdinalIgnoreCase)||!Regex.IsMatch(Path.GetFileName(destino),@"\AVictoria-(?:Instalador|Auditoria)-[a-f0-9]{32}\z"))return;
   try{Directory.Delete(destino,true);}catch{}
  }
  [STAThread] static int Main(string[] args) {
   ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
   // Estos modos no crean ventanas ni ejecutan el launcher: permiten verificar el binario publicado.
   if(args.Length>0&&args[0]=="--autoprueba")return Autoprueba();
   if(args.Length>0&&(args[0]=="--verificar"||args[0]=="--verificar-descarga")){
    string carpeta=null;try{var d=new Descargador();var v=d.Ultima();if(args[0]=="--verificar-descarga"){carpeta=Path.Combine(Path.GetTempPath(),"Victoria-Auditoria-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(carpeta);d.Descargar(v,Path.Combine(carpeta,"instalador.exe"),(p,t)=>{});}Console.WriteLine(v.Version+" "+v.Sha256+" "+v.Tamano);return 0;}catch(Exception e){Console.Error.WriteLine("No se pudo verificar la publicación: "+e.GetType().Name);return 1;}finally{if(carpeta!=null)Programa.LimpiarTemporal(carpeta);}}
   if(args.Length>0){Console.Error.WriteLine("Opción no reconocida.");return 2;}
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new Ventana());return 0;
  }
  static int Autoprueba() {
   string valido="{\"version\":\"1.8.3\",\"url\":\"https://github.com/FalconKing574/victoria-launcher/releases/download/v1.8.3/Victoria-Kingdom-actualizacion-1.8.3.exe\",\"sha256\":\""+new string('a',64)+"\",\"size\":10000000}";
   int n=0;VersionPublicada.Leer(valido,false);n++;
   foreach(string malo in new[]{valido.Replace("https://github.com/","https://ajeno.invalid/"),valido.Replace("1.8.3","../vieja"),valido.Replace(new string('a',64),"sin-hash"),valido.Replace("10000000","9999999999"),"{}"}){try{VersionPublicada.Leer(malo,false);Console.Error.WriteLine("Aceptó una publicación no válida.");return 1;}catch{n++;}}
   Console.WriteLine(n+" comprobaciones del instalador correctas.");return 0;
  }
 }
}
