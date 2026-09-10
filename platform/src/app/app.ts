import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NativeCapabilityHostService } from './core/native-capability-host.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly capabilities = inject(NativeCapabilityHostService);

  ngOnInit(): void { this.capabilities.start(); }
  ngOnDestroy(): void { this.capabilities.stop(); }
}
