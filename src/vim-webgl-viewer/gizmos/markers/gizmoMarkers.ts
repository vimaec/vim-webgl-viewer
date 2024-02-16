import { Viewer } from '../../viewer';
import * as THREE from 'three';
import { GizmoMarker } from './gizmoMarker';

export class GizmoMarkers {
  private _viewer: Viewer;
  private _markers: GizmoMarker[] = [];

  constructor (viewer: Viewer){
    this._viewer = viewer
  }

  add(position: THREE.Vector3) {

    var marker = new GizmoMarker(this._viewer);
    marker.position.copy(position);
    marker.load();
    this._markers.push(marker);
  }

  remove(marker: GizmoMarker) {

    marker.unload();
    var index = this._markers.findIndex(m => m === marker);
    this._markers[index] = this._markers[this._markers.length - 1];
    this._markers.length -= 1;
  }

  clear() {
    this._markers.forEach(m => m.unload());
    this._markers.length = 0;
  }
}
