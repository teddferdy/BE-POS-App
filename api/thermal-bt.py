#!/usr/bin/env python3
"""Print ESC/POS data to RPP02N over native IOBluetooth RFCOMM."""
import os, sys, time
from Foundation import NSObject, NSRunLoop, NSDate
from IOBluetooth import IOBluetoothDevice

def print_bt(mac, data, timeout=5):
    device = IOBluetoothDevice.deviceWithAddressString_(mac)
    if not device: return False, 'Device not found'
    if not device.isConnected():
        r = device.openConnection()
        if r: return False, f'Connection failed: {r}'
    status, rfcomm = device.openRFCOMMChannelSync_withChannelID_delegate_(None, 1, NSObject.alloc().init())
    if not rfcomm or not rfcomm.isOpen():
        return False, f'RFCOMM open failed: {status}'
    # ponytail: establishKernelConnection enables writeSync to transmit
    rfcomm.establishKernelConnection()
    r = rfcomm.writeSync_length_(data, len(data))
    time.sleep(0.5)
    rfcomm.closeChannel()
    NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.3))
    device.closeConnection()
    return (True, 'Printed') if r == 0 else (False, f'Write error: {r}')

if __name__ == '__main__':
    mac = os.environ.get('BT_PRINTER_MAC', '86:67:7A:E4:30:C7').lower()
    data = sys.stdin.buffer.read()
    if not data:
        print('No data')
        sys.exit(1)
    ok, msg = print_bt(mac, data)
    print(msg)
    sys.exit(0 if ok else 1)
