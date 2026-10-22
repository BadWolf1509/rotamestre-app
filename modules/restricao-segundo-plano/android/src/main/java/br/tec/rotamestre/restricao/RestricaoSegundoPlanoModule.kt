package br.tec.rotamestre.restricao

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Uso de bateria "Restrito" do app (appops RUN_ANY_IN_BACKGROUND = ignore).
 * Com ele o Android mata o serviço de localização e descarta o push quando o
 * app sai da tela. Lado JS: src/lib/restricaoSegundoPlano.ts.
 */
class RestricaoSegundoPlanoModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RestricaoSegundoPlano")

    // isBackgroundRestricted existe desde o Android 9 (API 28); antes, não há
    // essa restrição por app.
    Function("estaRestrito") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return@Function false
      val activityManager =
        context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      activityManager?.isBackgroundRestricted ?: false
    }

    // Tela "Uso da bateria do app", onde ficam Sem restrições / Otimizado /
    // Restrito. Exportada pelo app Configurações, mas fora da API pública:
    // se não existir no aparelho, a exceção chega ao JS, que abre as
    // configurações gerais do app.
    AsyncFunction("abrirUsoDeBateria") {
      val intent = Intent(
        "android.settings.VIEW_ADVANCED_POWER_USAGE_DETAIL",
        Uri.fromParts("package", context.packageName, null)
      )
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }
}
