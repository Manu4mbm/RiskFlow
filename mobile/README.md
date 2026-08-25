# RiskFlow — iOS shell (Capacitor)

Everything cross-platform (the Capacitor config, the static web bundle, the
icon/splash source images) is already committed. The steps below only need
things that require an actual Mac: Xcode, CocoaPods, and code signing.

## One-time setup on the Mac

```bash
# Xcode (from the App Store) must be installed and opened once already,
# with the license accepted and command-line tools set:
xcode-select --install   # if not already done
sudo gem install cocoapods   # if `pod --version` doesn't already work

git clone https://github.com/Manu4mbm/RiskFlow.git
cd RiskFlow/mobile
npm install
```

## Generate the native iOS project

```bash
npx cap add ios          # creates ios/ -- the actual Xcode project
npx cap sync ios         # copies www/ into it (re-run this after any web app change)
```

## Generate the app icon + launch screen from the source images

`resources/icon.png` (1024×1024, flat, no transparency) and
`resources/splash.png` / `splash-dark.png` are already committed — this step
just renders them into the sizes Xcode's asset catalog needs:

```bash
npx @capacitor/assets generate --ios
```

## Open it in Xcode

```bash
npx cap open ios
```

In Xcode, on the **App** target → **Signing & Capabilities**:
- Check **Automatically manage signing**.
- Select your **Team** (this appears once your Apple Developer Program
  enrollment — the $99/year one — is active; sign in via Xcode → Settings →
  Accounts with the same Apple ID first if it's not listed).
- Bundle Identifier is already set to `com.protechsynergy.riskflow` in
  `capacitor.config.json` — change it in both places if you want something
  else, before your first TestFlight upload (it's essentially permanent once
  App Store Connect has an app registered under it).

Then:
1. **Product → Run** (⌘R) with a Simulator or your plugged-in iPhone selected — confirms it actually works natively first.
2. **Product → Archive** (only enabled with a real device or "Any iOS Device" selected as the destination, not a Simulator).
3. In the Organizer window that opens after archiving: **Distribute App → App Store Connect → Upload**.
4. Go to **appstoreconnect.apple.com** → My Apps → **+** → New App, matching the bundle ID above, and attach the build once it finishes processing (a few minutes to ~an hour).
5. Add the privacy policy URL: `https://riskflow-5aja.onrender.com/privacy/`
6. TestFlight first (add yourself as an internal tester) before submitting for full App Store review.

## When the web app changes

```bash
cd .. && .venv/Scripts/python scripts/export_static.py   # on Windows, regenerates mobile/www
cd mobile && npx cap sync ios                              # re-run on the Mac after pulling
```
