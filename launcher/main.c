#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <shellapi.h>
#include <stdio.h>
#include <wchar.h>

/* A stable, pinnable entry point. All install paths come from this executable. */
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR command, int show) {
    (void)instance; (void)previous; (void)show; (void)command;
    int argc = 0;
    LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    int check = argv && argc == 2 && wcscmp(argv[1], L"--check") == 0;
    if (argv) LocalFree(argv);
    wchar_t root[32768], manager[32768], desktop[32768], powershell[32768];
    wchar_t arguments[32768], data[32768], logpath[32768], message[2048];
    DWORD count = GetModuleFileNameW(NULL, root, 32768);
    if (!count || count >= 32768 || !wcsrchr(root, L'\\')) return 2;
    *wcsrchr(root, L'\\') = 0;
    if (wcslen(root) > 12000) return 2;
    swprintf(manager, 32768, L"%ls\\Manager.ps1", root);
    swprintf(desktop, 32768, L"%ls\\desktop\\MyifyDesktop.exe", root);
    logpath[0] = 0;
    if (GetEnvironmentVariableW(L"LOCALAPPDATA", data, 32768) && wcslen(data) < 12000) {
        wcscat(data, L"\\SpotifyNativeEnhancerData"); CreateDirectoryW(data, NULL);
        swprintf(logpath, 32768, L"%ls\\launcher.log", data);
    }
    DWORD result = 0;
    if (GetFileAttributesW(manager) == INVALID_FILE_ATTRIBUTES ||
        GetFileAttributesW(desktop) == INVALID_FILE_ATTRIBUTES) {
        swprintf(message, 2048, L"Myify's installed files are missing. Run the Myify installer again.\n\nLauncher folder: %.1500ls", root);
        result = 2; goto failed;
    }
    if (!GetSystemDirectoryW(powershell, 32768) || wcslen(powershell) > 12000) return 2;
    wcscat(powershell, L"\\WindowsPowerShell\\v1.0\\powershell.exe");
    swprintf(arguments, 32768, L"\"%ls\" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"%ls\" -Action %ls -Quiet",
             powershell, manager, check ? L"Check" : L"Launch");
    SECURITY_ATTRIBUTES security = {sizeof(SECURITY_ATTRIBUTES), NULL, TRUE};
    HANDLE output = logpath[0] ? CreateFileW(logpath, FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, &security, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL) : INVALID_HANDLE_VALUE;
    HANDLE input = CreateFileW(L"NUL", GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, &security, OPEN_EXISTING, 0, NULL);
    STARTUPINFOW startup = {0}; PROCESS_INFORMATION process = {0}; startup.cb = sizeof(startup);
    if (output != INVALID_HANDLE_VALUE && input != INVALID_HANDLE_VALUE) {
        startup.dwFlags = STARTF_USESTDHANDLES;
        startup.hStdInput = input; startup.hStdOutput = output; startup.hStdError = output;
    }
    BOOL started = CreateProcessW(powershell, arguments, NULL, NULL, TRUE, CREATE_NO_WINDOW, NULL, root, &startup, &process);
    DWORD error = started ? 0 : GetLastError();
    if (output != INVALID_HANDLE_VALUE) CloseHandle(output);
    if (input != INVALID_HANDLE_VALUE) CloseHandle(input);
    if (!started) {
        swprintf(message, 2048, L"Windows could not start Myify's manager (error %lu).", error);
        result = 3; goto failed;
    }
    DWORD wait = WaitForSingleObject(process.hProcess, 120000);
    DWORD exitcode = 1;
    if (wait == WAIT_OBJECT_0) GetExitCodeProcess(process.hProcess, &exitcode);
    CloseHandle(process.hThread); CloseHandle(process.hProcess);
    if (wait != WAIT_OBJECT_0 || exitcode) {
        swprintf(message, 2048, L"Myify could not finish starting (manager code %lu).\n\nDetails: %.1500ls\n\nRun setup again if files are missing, or check the supported Spotify version.", exitcode, logpath);
        result = 4; goto failed;
    }
    /* The manager starts the helper with --hidden. Advanced tools are opened
       explicitly from Spotify or their separate Start menu entry. */
    return 0;
failed:
    if (!check) MessageBoxW(NULL, message, L"Myify startup", MB_OK | MB_ICONERROR);
    return (int)result;
}
