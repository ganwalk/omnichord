# Guia de publicação — Omnichord OM-84

Este projeto agora é um app multiplataforma feito com [Capacitor](https://capacitorjs.com/), que empacota o `www/index.html` original (sem nenhuma mudança de comportamento) dentro de um app nativo para Android e iOS, além de uma camada PWA que permite empacotar para a Microsoft Store.

## O que já está pronto neste repositório

- `www/` — o app original (HTML/CSS/JS, Web Audio API), agora com `manifest.json` e `service-worker.js` (PWA instalável e funciona offline).
- `android/` — projeto nativo Android completo (Gradle), com ícone adaptativo, splash screen e nome do app já configurados. **Build de debug testado e funcionando** (`./gradlew assembleDebug` gera um APK instalável).
- `ios/` — projeto nativo Xcode completo, com ícone e splash configurados. Não pôde ser compilado neste ambiente (Linux) — build de iOS exige um Mac com Xcode.
- `resources/` — as imagens-mestre do ícone/splash (caso queira ajustar o design depois).
- `capacitor.config.json` — id do app: `com.ganwalk.omnichord`, nome: "Omnichord OM-84".

## Como abrir e buildar localmente

```bash
npm install
npx cap sync          # copia www/ para dentro de android/ e ios/ sempre que você editar o HTML
npx cap open android  # abre no Android Studio
npx cap open ios      # abre no Xcode (só funciona num Mac)
```

Sempre que editar `www/index.html`, rode `npx cap sync` antes de gerar um novo build.

---

## 1. Google Play Store (Android)

**Custo:** taxa única de US$ 25 (conta de desenvolvedor).

1. Crie uma conta em [Google Play Console](https://play.google.com/console).
2. Gere uma chave de assinatura (keystore) — necessária para builds de release:
   ```bash
   keytool -genkey -v -keystore omnichord-release.keystore -alias omnichord -keyalg RSA -keysize 2048 -validity 10000
   ```
   Guarde essa chave e a senha em local seguro — sem ela você não consegue mais atualizar o app depois de publicado.
3. Configure a assinatura em `android/app/build.gradle` (ou, mais simples: no Android Studio, `Build > Generate Signed Bundle / APK`).
4. Gere um **Android App Bundle** (formato exigido pela Play Store, não APK):
   ```bash
   cd android && ./gradlew bundleRelease
   ```
   O arquivo sai em `android/app/build/outputs/bundle/release/app-release.aab`.
5. No Play Console: crie o app, preencha a ficha da loja (descrição, categoria "Música e áudio", capturas de tela — pode gravar a tela do app rodando), classificação de conteúdo, política de privacidade (veja seção abaixo) e envie o `.aab`.
6. Primeiro envio passa por revisão (normalmente 1–3 dias).

## 2. Apple App Store (iOS)

**Custo:** US$ 99/ano (Apple Developer Program).
**Requisito importante:** compilar e enviar um app iOS só é possível a partir de um **Mac com Xcode** — não é possível fazer isso neste ambiente Linux. Passos para quando você tiver acesso a um Mac:

1. Inscreva-se em [developer.apple.com](https://developer.apple.com/programs/).
2. Instale o Xcode, clone este repositório no Mac, rode `npm install && npx cap sync ios && npx cap open ios`.
3. No Xcode: configure o "Team" (sua conta Apple) em Signing & Capabilities — ele cuida de criar os certificados e perfis de provisionamento automaticamente.
4. `Product > Archive` para gerar o build, depois `Distribute App > App Store Connect` para enviar.
5. Em [App Store Connect](https://appstoreconnect.apple.com/), crie a ficha do app (nome, descrição, categoria, capturas de tela — precisa de várias resoluções de iPhone/iPad), política de privacidade, e envie para revisão.

Alternativa sem Mac próprio: serviços como [Codemagic](https://codemagic.io/) ou [Ionic Appflow](https://ionic.io/appflow) fazem build de iOS na nuvem a partir do repositório Git, sem precisar de um Mac físico.

## 3. Microsoft Store (Windows)

Como o app já é uma PWA completa (`manifest.json` + `service-worker.js`), o caminho mais simples é o [PWABuilder](https://www.pwabuilder.com/):

1. Publique o conteúdo de `www/` em uma URL pública com HTTPS — a forma mais rápida é ativar o **GitHub Pages** neste repositório (Settings → Pages → servir a pasta `www/` ou a branch), já que o app é 100% estático.
2. Acesse pwabuilder.com, cole a URL pública, e clique em "Package for Windows" — ele gera um pacote `.msix` automaticamente a partir do manifest já configurado.
3. Crie uma conta de desenvolvedor na [Microsoft Partner Center](https://partner.microsoft.com/dashboard) (taxa única, atualmente ~US$ 19 para conta individual) e envie o `.msix`.

Esse mesmo passo 1 (GitHub Pages) também deixa o Omnichord instalável direto do navegador em qualquer plataforma (Android, iOS, desktop) via "Adicionar à tela inicial" — útil como distribuição extra além das lojas.

## 4. Política de privacidade

Todas as três lojas exigem uma URL de política de privacidade, mesmo para apps que não coletam dados (que é o caso aqui — o Omnichord não usa rede, câmera, microfone nem armazena nada do usuário). Uma página simples de uma frase, hospedada no mesmo GitHub Pages, resolve. Posso gerar esse texto se você quiser.

## 5. Itens que só você pode decidir/fazer

- Criar as contas de desenvolvedor (Google, Apple, Microsoft) — exigem CPF/CNPJ ou cartão de crédito.
- Build e assinatura do release Android (posso te ajudar a gerar o comando, mas a keystore e senha ficam com você).
- Build e envio do iOS (precisa de Mac + conta Apple).
- Textos finais da ficha da loja, capturas de tela e política de privacidade (posso rascunhar, mas a voz final é sua).

## Checklist rápido

- [x] App empacotado com Capacitor (Android + iOS)
- [x] Ícone e splash screen no visual do instrumento
- [x] PWA instalável (manifest + service worker)
- [x] Build Android de debug testado e funcionando
- [ ] Keystore de release Android gerada
- [ ] Conta Google Play Console criada e app enviado
- [ ] Conta Apple Developer criada e app enviado (requer Mac)
- [ ] GitHub Pages publicado + pacote gerado no PWABuilder
- [ ] Política de privacidade publicada
