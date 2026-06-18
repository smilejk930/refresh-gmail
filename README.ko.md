# Refresh Gmail

[English README](README.md)

Refresh Gmail은 Windows 트레이 앱입니다. 지정한 주기마다 POP3 메일함을 확인하고, 새 메일을 Gmail API로 Gmail에 가져옵니다. Gmail의 기본 "다른 계정에서 메일 확인" POP 가져오기 기능에 의존하지 않습니다.

## 동작 방식

- `verify` 모드는 POP3에 연결해 최근 메일 헤더를 읽고, 각 `Message-ID`가 Gmail에 이미 있는지만 확인합니다. 메일을 가져오지는 않습니다.
- `import` 모드는 아직 동기화되지 않은 POP3 메일을 가져와 Gmail에서 `rfc822msgid:<Message-ID>`로 검색하고, Gmail에 없는 메일만 import합니다.
- POP3 서버의 메일은 삭제하지 않습니다.
- POP3 `UIDL`은 Gmail에 이미 메일이 있거나 Gmail import가 성공한 뒤에만 로컬 상태에 저장됩니다.

## 설정 순서

1. Google Cloud Console에서 OAuth Desktop client를 만들고 `credentials.json`을 다운로드합니다.
2. 해당 Google Cloud 프로젝트에서 Gmail API를 활성화합니다.
3. 앱을 실행합니다.

```powershell
cmd /c npm start
```

4. 트레이 메뉴에서 POP 비밀번호를 저장하고 Gmail 인증을 진행합니다.
5. 트레이 메뉴에서 설정 폴더를 열고 `%APPDATA%\\refresh-gmail\\config.json`을 수정합니다.
6. 기존 Gmail POP 가져오기 설정을 유지한 상태에서 먼저 `"mode": "verify"`로 실행합니다.
7. 확인 결과가 정상이라면 Gmail의 기존 POP 가져오기 설정을 제거하고 `"mode": "import"`로 변경합니다.

## 설정 파일

앱은 `%APPDATA%\\refresh-gmail\\config.json`을 읽습니다. 전체 예시는 [config.example.json](config.example.json)을 참고하세요.

필수 값:

- `mode`: `verify` 또는 `import`
- `pollIntervalMinutes`: `1` 이상의 정수
- `pop3.host`
- `pop3.port`
- `pop3.security`: `tls`, `starttls`, 또는 `plain`
- `pop3.username`
- `gmail.credentialsPath`

비밀값은 이 JSON 파일에 저장하지 않습니다. Gmail OAuth 토큰과 POP3 비밀번호는 Electron `safeStorage`로 암호화되어 `%APPDATA%\\refresh-gmail` 아래에 저장됩니다.

POP3는 `tls` 또는 `starttls` 사용을 권장합니다. `plain`은 TLS 없이 메일함 비밀번호를 전송하므로, `pop3.allowInsecurePlainAuth`를 명시적으로 `true`로 설정한 경우에만 허용됩니다.

Gmail OAuth scope는 메일 가져오기와 기존 메일 검색에 필요한 권한으로 제한되어 있습니다.

- `https://www.googleapis.com/auth/gmail.insert`
- `https://www.googleapis.com/auth/gmail.readonly`

## GitHub 공개 전 주의사항

로컬 실행 파일이나 Google OAuth 다운로드 파일을 커밋하지 마세요. `.gitignore`는 다음 민감 파일 이름을 제외합니다.

- `credentials*.json`
- `client_secret*.json`
- `token*.json`
- `config.json`
- `state.json`
- `secrets*.json`
- `*.enc.json`
- `activity.log`

`dist/` 아래의 패키징된 EXE도 제외됩니다. 필요하면 GitHub Release asset으로 올리는 방식을 권장합니다.

## 개발

```powershell
cmd /c npm install
cmd /c npm test
cmd /c npm start
cmd /c npm run package
```

Windows PowerShell에서 `npm.ps1` 실행이 막힐 수 있으므로 `cmd /c npm ...` 형태로 실행하세요.
