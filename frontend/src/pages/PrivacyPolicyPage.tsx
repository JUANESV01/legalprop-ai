import React from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  FileCheck2,
  Trash2,
  Download,
  Mail,
  Sparkles,
  Scale,
  AlertTriangle,
} from 'lucide-react';
import { Logo } from '../components/Logo';

interface PrivacyPolicyPageProps {
  onNavigate: (path: string) => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-cream-100 text-slate-800 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
      <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-left focus:outline-none"
          >
            <Logo size="sm" showText={true} />
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al inicio</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/chat/new')}
              className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors"
            >
              Ir al chat
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        {/* Encabezado */}
        <div className="space-y-3 border-b border-cream-200 pb-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>RTK Solutions • Ley 1581 de 2012 • Decreto 1377 de 2013 • v1.1-2026</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-950 font-display leading-tight">
            Política de Tratamiento de Datos y Términos de Uso
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
            Documento legal aplicable a <strong>LegalProp AI</strong>, producto digital desarrollado bajo la iniciativa <strong>RTK Solutions</strong>, en cumplimiento del artículo 15 de la Constitución Política de Colombia, la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href="#politica-datos"
              className="px-3 py-1.5 rounded-lg bg-white border border-cream-300 hover:border-teal-600 text-xs font-semibold text-slate-800 transition-colors"
            >
              I. Política de Tratamiento de Datos
            </a>
            <a
              href="#uso-ia"
              className="px-3 py-1.5 rounded-lg bg-white border border-cream-300 hover:border-teal-600 text-xs font-semibold text-slate-800 transition-colors"
            >
              II. Documentos y Procesamiento con IA
            </a>
            <a
              href="#terminos"
              className="px-3 py-1.5 rounded-lg bg-white border border-cream-300 hover:border-teal-600 text-xs font-semibold text-slate-800 transition-colors"
            >
              III. Términos y Condiciones de Uso
            </a>
          </div>
        </div>

        {/* PARTE I: POLÍTICA DE TRATAMIENTO DE DATOS */}
        <article
          id="politica-datos"
          className="bg-white border border-cream-200 rounded-2xl shadow-soft p-6 sm:p-9 space-y-7 text-xs sm:text-sm text-slate-700 leading-relaxed"
        >
          <div className="border-b border-cream-200 pb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
              Parte I
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-950 font-display">
              Política de Tratamiento de Datos Personales (Habeas Data)
            </h2>
          </div>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-slate-950 font-display">
              1. Responsable del Tratamiento y Naturaleza de la Iniciativa
            </h3>
            <p>
              <strong>LegalProp AI</strong> (<code>legalprop.site</code>) es un producto digital que hace parte de la iniciativa tecnológica independiente <strong>RTK Solutions</strong>. Se informa expresamente a los usuarios que, a la fecha de publicación de este documento, <strong>RTK Solutions no se encuentra constituida aún como persona jurídica societaria</strong>; LegalProp AI forma parte de su portafolio en construcción y fue desarrollado inicialmente como proyecto académico en la asignatura <em>Laboratorio de Software</em> (Universidad Tecnológica de Pereira — UTP, Colombia).
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-teal-700" />
                Canal de privacidad y Habeas Data: <strong>robotiktronikx@gmail.com</strong>
              </span>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-slate-950 font-display">
              2. Datos Personales Recolectados y Minimización
            </h3>
            <p>
              RTK Solutions aplica el principio de minimización de datos, recolectando únicamente la información necesaria para operar LegalProp AI:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Datos de identificación básica:</strong> nombre completo, correo electrónico y perfil seleccionado (inquilino, propietario o administrador).
              </li>
              <li>
                <strong>Credenciales de seguridad cifradas:</strong> contraseña, respuestas a 3 preguntas de seguridad y código maestro de respaldo, almacenados exclusivamente como hashes irreversibles mediante <code>bcrypt</code> (costo 12). Nunca se guardan en texto plano.
              </li>
              <li>
                <strong>Contenido suministrado voluntariamente:</strong> historial de conversaciones jurídicas y documentos subidos por el titular (contratos, manuales de convivencia o actas en PDF, DOCX, XLSX, ODT, TXT o imagen).
              </li>
              <li>
                <strong>Prueba de consentimiento y bitácora sanitizada:</strong> fecha/versión de aceptación de esta política y registros de eventos de acceso con dirección IP anonimizada mediante <code>HMAC-SHA256</code>.
              </li>
            </ul>
            <p className="text-xs text-slate-500">
              LegalProp AI <strong>no solicita ni está diseñado para recolectar datos sensibles</strong> (salud, origen racial, orientación política o religiosa, biometría) ni datos de niños, niñas o adolescentes.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-slate-950 font-display">
              3. Finalidades del Tratamiento
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Prestar orientación normativa informativa sobre arrendamiento urbano (Ley 820 de 2003) y propiedad horizontal (Ley 675 de 2001).</li>
              <li>Extraer, indexar y consultar documentos cargados voluntariamente por el titular, manteniéndolos aislados de otros usuarios dentro de la plataforma.</li>
              <li>Conservar el historial de chats (<code>/chat/&lt;id&gt;</code>) y permitir la descarga de constancias en PDF.</li>
              <li>Evaluar y mejorar la calidad operativa del asistente y procesar consultas/documentos mediante servicios de inteligencia artificial.</li>
              <li>Proteger las cuentas con sesiones JWT, bloqueo automático tras 5 intentos fallidos y recuperación verificada.</li>
            </ul>
          </section>

          <section id="uso-ia" className="space-y-3">
            <div className="p-4 sm:p-5 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                <span>4. Uso de Documentos y Consultas con Inteligencia Artificial (Google Gemini API)</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>Aislamiento interno:</strong> Dentro de LegalProp AI, tus archivos privados y chats se aíslan estrictamente por cuenta (<code>owner_scope</code> en ChromaDB y <code>owner_id</code> en PostgreSQL); ningún otro usuario de la plataforma puede acceder a ellos.
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>Procesamiento y aprendizaje de la IA:</strong> Para analizar tus archivos y generar respuestas, las consultas y los fragmentos relevantes de los documentos que subas son transmitidos sobre conexiones cifradas <strong>HTTPS/TLS</strong> a la <strong>API de Google Gemini</strong>. De acuerdo con los términos aplicables al nivel gratuito/estándar de la API de Google Gemini, <strong>los textos, preguntas y fragmentos de documentos procesados pueden ser utilizados por el proveedor de inteligencia artificial para entrenar, evaluar y mejorar sus modelos de IA</strong>, y RTK Solutions podrá emplear patrones técnicos anonimizados para perfeccionar el asistente.
              </p>
              <p className="text-xs text-amber-950 font-medium leading-relaxed">
                Recomendación obligatoria: Antes de subir contratos, actas o reglamentos, elimina o anonimiza números de cédula, firmas, cuentas bancarias, direcciones exactas o datos personales de terceros que no cuenten con autorización.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-950 font-display">
              5. Derechos del Titular (Habeas Data — Art. 8 Ley 1581 de 2012)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-cream-50 border border-cream-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                  <Download className="w-3.5 h-3.5 text-teal-700" />
                  <span>Acceso y portabilidad directa</span>
                </div>
                <p className="text-xs text-slate-600">
                  Descarga en cualquier momento una copia completa en JSON de tu perfil, prueba de autorización, documentos e historial desde <strong>Mi cuenta → Descargar copia de mis datos</strong>.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-cream-50 border border-cream-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                  <Trash2 className="w-3.5 h-3.5 text-teal-700" />
                  <span>Revocatoria y supresión definitiva</span>
                </div>
                <p className="text-xs text-slate-600">
                  Elimina en un clic y de manera irreversible tu cuenta, conversaciones, archivos privados, vectores y bitácora desde <strong>Mi cuenta → Eliminar cuenta y datos</strong>.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-cream-50 border border-cream-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                  <FileCheck2 className="w-3.5 h-3.5 text-teal-700" />
                  <span>Prueba de autorización</span>
                </div>
                <p className="text-xs text-slate-600">
                  Conservamos la fecha exacta y versión de tu consentimiento expreso (<code>v1.1-2026</code>), visible en tu perfil y en tu exportación de Habeas Data.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-cream-50 border border-cream-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                  <Lock className="w-3.5 h-3.5 text-teal-700" />
                  <span>Seguridad e infraestructura</span>
                </div>
                <p className="text-xs text-slate-600">
                  HTTPS/TLS, PostgreSQL en Neon con SSL obligatorio, hash <code>bcrypt</code>, cabeceras de seguridad HTTP y cero comercialización de datos.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-slate-950 font-display">
              6. Consultas, Reclamos, Retención y Vigencia
            </h3>
            <p>
              Además de la autogestión inmediata dentro de la plataforma, cualquier titular podrá presentar consultas o reclamos a través de <strong>robotiktronikx@gmail.com</strong>. Las consultas serán atendidas en un plazo máximo de diez (10) días hábiles y los reclamos en quince (15) días hábiles conforme a los artículos 14 y 15 de la Ley 1581 de 2012. Los datos se conservan únicamente mientras la cuenta esté activa o hasta que el titular solicite su supresión.
            </p>
          </section>
        </article>

        {/* PARTE II: TÉRMINOS Y CONDICIONES DE USO */}
        <article
          id="terminos"
          className="bg-white border border-cream-200 rounded-2xl shadow-soft p-6 sm:p-9 space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed"
        >
          <div className="border-b border-cream-200 pb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
              Parte II
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-950 font-display">
              Términos y Condiciones de Uso — RTK Solutions (LegalProp AI)
            </h2>
          </div>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-slate-950 font-display flex items-center gap-2">
              <Scale className="w-4 h-4 text-teal-700" />
              <span>1. Aceptación y Naturaleza del Servicio</span>
            </h3>
            <p>
              Al acceder, navegar, subir documentos o registrarte en <strong>LegalProp AI</strong> (producto de <strong>RTK Solutions</strong>), aceptas estos Términos y Condiciones. El servicio se encuentra en evolución continua (versión informativa/beta nacida inicialmente en un entorno académico) y se ofrece <strong>&ldquo;tal cual&rdquo;</strong> y <strong>&ldquo;según disponibilidad&rdquo;</strong>, sin garantías implícitas de disponibilidad ininterrumpida o idoneidad para procesos judiciales específicos.
            </p>
          </section>

          <section className="space-y-2">
            <div className="p-4 rounded-xl bg-cream-100 border border-cream-300 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-950 text-xs sm:text-sm">
                <AlertTriangle className="w-4 h-4 text-teal-800 shrink-0" />
                <span>2. Deslinde de Responsabilidad Jurídica (No Asesoría Legal Vinculante)</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                LegalProp AI es una herramienta de <strong>orientación normativa informativa y pedagógica</strong>. Sus respuestas, cálculos de IPC y constancias en PDF <strong>no constituyen concepto jurídico vinculante, representación legal ni relación abogado-cliente</strong>, ni reemplazan el criterio profesional de un abogado titulado. RTK Solutions no asume responsabilidad por daños directos, indirectos, sanciones, pérdidas económicas o decisiones contractuales o judiciales tomadas con base en la información generada por el asistente.
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-slate-950 font-display">
              3. Verificación Humana y Limitaciones de la IA
            </h3>
            <p>
              Aunque LegalProp AI emplea recuperación documental (RAG) y citas normativas para reducir errores, los modelos de lenguaje pueden presentar imprecisiones, omisiones o desactualizaciones normativas. El usuario es el único responsable de verificar el texto oficial vigente de las leyes, decretos, tasas de IPC del DANE y cláusulas de su contrato antes de tomar decisiones.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-slate-950 font-display">
              4. Propiedad Intelectual y Licencia sobre Documentos Subidos
            </h3>
            <p>
              La identidad <strong>RTK Solutions</strong>, la marca <strong>LegalProp AI</strong>, su diseño, arquitectura y código fuente pertenecen a la iniciativa RTK Solutions. El usuario conserva todos los derechos sobre los archivos que cargue y declara contar con autorización legítima para subirlos, otorgando a RTK Solutions una licencia limitada, no exclusiva y revocable únicamente para extraer su texto, indexarlo en su espacio privado y procesarlo mediante los modelos de IA necesarios para prestar el servicio.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-slate-950 font-display">
              5. Uso Aceptable, Modificaciones y Legislación Aplicable
            </h3>
            <p>
              Queda prohibido utilizar la plataforma para fines ilícitos, cargar archivos maliciosos, intentar vulnerar el aislamiento entre cuentas, realizar extracción automatizada masiva (scraping) o suplantar identidades. RTK Solutions podrá actualizar estos términos y políticas en cualquier momento publicando la nueva versión en esta página. Estos términos se rigen por las leyes de la <strong>República de Colombia</strong>.
            </p>
            <p className="text-xs text-slate-500 pt-2">
              <strong>Vigencia actual:</strong> Versión <code>v1.1-2026</code> — Última actualización: 23 de noviembre de 2026 • RTK Solutions — LegalProp AI.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
};
