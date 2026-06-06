#import <Foundation/Foundation.h>
#import <Security/Security.h>

static void fail(NSString *message, int status) {
  NSData *data = [[message stringByAppendingString:@"\n"] dataUsingEncoding:NSUTF8StringEncoding];
  [[NSFileHandle fileHandleWithStandardError] writeData:data];
  exit(status);
}

int main(int argc, const char * argv[]) {
  @autoreleasepool {
    if (argc != 4) {
      fail(@"Usage: longread-keychain <exists|get|set|delete> <service> <account>", 1);
    }

    NSString *command = [NSString stringWithUTF8String:argv[1]];
    NSString *service = [NSString stringWithUTF8String:argv[2]];
    NSString *account = [NSString stringWithUTF8String:argv[3]];

    NSDictionary *query = @{
      (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
      (__bridge id)kSecAttrService: service,
      (__bridge id)kSecAttrAccount: account
    };

    if ([command isEqualToString:@"exists"]) {
      NSMutableDictionary *existsQuery = [query mutableCopy];
      existsQuery[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;

      OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)existsQuery, NULL);
      if (status == errSecSuccess) {
        return 0;
      }
      if (status == errSecItemNotFound) {
        return 44;
      }
      fail([NSString stringWithFormat:@"Keychain lookup failed: %d", (int)status], 8);
    }

    if ([command isEqualToString:@"get"]) {
      NSMutableDictionary *getQuery = [query mutableCopy];
      getQuery[(__bridge id)kSecReturnData] = @YES;
      getQuery[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;

      CFTypeRef item = NULL;
      OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)getQuery, &item);
      if (status == errSecItemNotFound) {
        return 44;
      }
      if (status != errSecSuccess) {
        fail([NSString stringWithFormat:@"Keychain read failed: %d", (int)status], 2);
      }

      NSData *data = CFBridgingRelease(item);
      [[NSFileHandle fileHandleWithStandardOutput] writeData:data];
      return 0;
    }

    if ([command isEqualToString:@"set"]) {
      NSData *passwordData = [[NSFileHandle fileHandleWithStandardInput] readDataToEndOfFile];
      if (passwordData.length == 0) {
        fail(@"No password data provided.", 4);
      }

      NSDictionary *update = @{
        (__bridge id)kSecValueData: passwordData
      };
      OSStatus updateStatus = SecItemUpdate((__bridge CFDictionaryRef)query, (__bridge CFDictionaryRef)update);
      if (updateStatus == errSecSuccess) {
        return 0;
      }
      if (updateStatus != errSecItemNotFound) {
        fail([NSString stringWithFormat:@"Keychain update failed: %d", (int)updateStatus], 5);
      }

      NSMutableDictionary *addQuery = [query mutableCopy];
      addQuery[(__bridge id)kSecValueData] = passwordData;
      OSStatus addStatus = SecItemAdd((__bridge CFDictionaryRef)addQuery, NULL);
      if (addStatus != errSecSuccess) {
        fail([NSString stringWithFormat:@"Keychain add failed: %d", (int)addStatus], 6);
      }
      return 0;
    }

    if ([command isEqualToString:@"delete"]) {
      OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);
      if (status == errSecSuccess || status == errSecItemNotFound) {
        return 0;
      }
      fail([NSString stringWithFormat:@"Keychain delete failed: %d", (int)status], 7);
    }

    fail(@"Unknown command.", 1);
  }
}
