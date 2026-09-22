import 'package:flutter_test/flutter_test.dart';
import 'package:thermal_3d/thermal_3d.dart';

void main() {
  test('Demo can supply heating below the old visual neutral point', () {
    const zoneState = ThermalZoneState(
        targetTemperature: 26,
        operatingState: ThermalOperation.heating,
        online: true,
        stale: false);
    final zone = zoneState.toJson();
    expect(zone['operatingState'], 'heating');
    expect(zone['targetTemperature'], 26);
  });
}
