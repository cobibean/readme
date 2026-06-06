import Foundation
import Security

enum Command: String {
    case get
    case set
    case delete
}

func fail(_ message: String, status: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(status)
}

guard CommandLine.arguments.count == 4 else {
    fail("Usage: longread-keychain <get|set|delete> <service> <account>")
}

guard let command = Command(rawValue: CommandLine.arguments[1]) else {
    fail("Unknown command.")
}

let service = CommandLine.arguments[2]
let account = CommandLine.arguments[3]

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account
]

switch command {
case .get:
    var getQuery = query
    getQuery[kSecReturnData as String] = true
    getQuery[kSecMatchLimit as String] = kSecMatchLimitOne

    var item: CFTypeRef?
    let status = SecItemCopyMatching(getQuery as CFDictionary, &item)
    if status == errSecItemNotFound {
        exit(44)
    }
    guard status == errSecSuccess else {
        fail("Keychain read failed: \(status)", status: 2)
    }
    guard let data = item as? Data else {
        fail("Keychain item did not contain data.", status: 3)
    }
    FileHandle.standardOutput.write(data)

case .set:
    let passwordData = FileHandle.standardInput.readDataToEndOfFile()
    guard !passwordData.isEmpty else {
        fail("No password data provided.", status: 4)
    }

    let update: [String: Any] = [
        kSecValueData as String: passwordData
    ]
    let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
    if updateStatus == errSecSuccess {
        exit(0)
    }
    guard updateStatus == errSecItemNotFound else {
        fail("Keychain update failed: \(updateStatus)", status: 5)
    }

    var addQuery = query
    addQuery[kSecValueData as String] = passwordData
    let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
    guard addStatus == errSecSuccess else {
        fail("Keychain add failed: \(addStatus)", status: 6)
    }

case .delete:
    let status = SecItemDelete(query as CFDictionary)
    if status == errSecSuccess || status == errSecItemNotFound {
        exit(0)
    }
    fail("Keychain delete failed: \(status)", status: 7)
}
