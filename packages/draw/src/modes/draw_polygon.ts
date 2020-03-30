import { IInteractionTarget, ILayer, ILngLat, Scene } from '@antv/l7';
import {
  Feature,
  FeatureCollection,
  featureCollection,
  Geometries,
  point,
  Position,
  Properties,
} from '@turf/helpers';
import DrawMidVertex from '../render/draw_mid_vertex';
import { DrawEvent, DrawModes, unitsType } from '../util/constant';
import { createPoint, createPolygon } from '../util/create_geometry';
import moveFeatures from '../util/move_featrues';
import DrawFeature, { IDrawFeatureOption } from './draw_feature';
export interface IDrawRectOption extends IDrawFeatureOption {
  units: unitsType;
  steps: number;
}
export default class DrawPolygon extends DrawFeature {
  protected startPoint: ILngLat;
  protected endPoint: ILngLat;
  protected points: ILngLat[] = [];
  protected pointFeatures: Feature[];
  protected drawMidVertexLayer: DrawMidVertex;

  constructor(scene: Scene, options: Partial<IDrawRectOption> = {}) {
    super(scene, options);
    this.type = 'polygon';
    this.drawMidVertexLayer = new DrawMidVertex(this);
    this.on(DrawEvent.MODE_CHANGE, this.addMidLayerEvent);
  }
  public enable() {
    super.enable();
    this.scene.on('mousemove', this.onMouseMove);
    this.scene.on('dblclick', this.onDblClick);
    // 关闭双击放大
  }

  public disable() {
    super.disable();
    this.scene.off('mousemove', this.onMouseMove);
    this.scene.off('dblclick', this.onDblClick);
  }

  public drawFinish() {
    const feature = this.createFeature(this.points);
    this.drawRender.update(feature);
    const pointfeatures = createPoint(this.points);
    this.pointFeatures = pointfeatures.features;
    this.drawVertexLayer.update(pointfeatures);
    this.emit(DrawEvent.CREATE, this.currentFeature);
    this.emit(DrawEvent.MODE_CHANGE, DrawModes.SIMPLE_SELECT);
    this.disable();
  }

  public addVertex(vertex: Feature<Geometries, Properties>) {
    // @ts-ignore
    const id = vertex.properties.id;
    const coord = vertex.geometry.coordinates as Position;
    const feature = this.currentFeature as Feature<Geometries, Properties>;
    const type = feature.geometry.type;
    const points = [];
    if (type === 'Polygon') {
      const coords = feature.geometry.coordinates as Position[][];
      coords[0].splice(id + 1, 0, coord);
      for (let i = 0; i < coords[0].length - 1; i++) {
        points.push({
          lng: coords[0][i][0],
          lat: coords[0][i][1],
        });
      }
    } else {
      const coords = feature.geometry.coordinates as Position[];
      coords.splice(id + 1, 0, coord);
      for (const coor of coords) {
        points.push({
          lng: coor[0],
          lat: coor[1],
        });
      }
    }
    const pointfeatures = createPoint(points);
    this.pointFeatures = pointfeatures.features;
    this.drawRender.updateData(featureCollection([feature]));
    this.drawVertexLayer.updateData(pointfeatures);
    this.drawMidVertexLayer.updateData(featureCollection(this.pointFeatures));
    this.setCurrentFeature(feature);
  }
  protected onDragStart = (e: IInteractionTarget) => {
    return null;
  };
  protected onDragging = (e: IInteractionTarget) => {
    return null;
  };

  protected onDragEnd = () => {
    return null;
  };

  protected onClick = (e: any) => {
    const lngLat = e.lngLat;
    this.endPoint = lngLat;
    this.points.push(lngLat);
    const feature = this.createFeature(this.points);
    const pointfeatures = createPoint([this.points[0], this.endPoint]);
    this.pointFeatures = pointfeatures.features;
    this.drawRender.update(feature);
    this.drawVertexLayer.update(pointfeatures);
    this.onDraw();
  };

  protected onMouseMove = (e: any) => {
    const lngLat = e.lngLat;
    if (this.points.length === 0) {
      return;
    }
    const tmpPoints = this.points.slice();
    tmpPoints.push(lngLat);
    const feature = this.createFeature(tmpPoints);
    this.drawRender.update(feature);
  };

  protected onDblClick = (e: any) => {
    const lngLat = e.lngLat;
    if (this.points.length < 2) {
      return;
    }
    this.points.push(lngLat);
    this.drawFinish();
  };

  protected moveFeature(delta: ILngLat): Feature {
    const newFeature = moveFeatures([this.currentFeature as Feature], delta);
    const newPointFeture = moveFeatures(this.pointFeatures, delta);
    this.drawRender.updateData(featureCollection(newFeature));
    this.drawVertexLayer.updateData(featureCollection(newPointFeture));
    this.currentFeature = newFeature[0];
    this.pointFeatures = newPointFeture;
    return this.currentFeature;
  }
  protected createFeature(points: ILngLat[]): FeatureCollection {
    const feature = createPolygon(points, {
      id: this.getUniqId(),
      type: 'polygon',
      active: true,
    });
    this.setCurrentFeature(feature as Feature);
    return {
      type: 'FeatureCollection',
      features: [feature],
    };
  }

  protected editFeature(vertex: ILngLat): FeatureCollection {
    const selectVertexed = this.currentVertex as Feature<
      Geometries,
      Properties
    >;
    if (selectVertexed === null) {
      return featureCollection([]);
    } else {
      // @ts-ignore
      const id = selectVertexed.properties.id;
      selectVertexed.geometry.coordinates = [vertex.lng, vertex.lat];
      // @ts-ignore
      this.pointFeatures[id].geometry.coordinates = [vertex.lng, vertex.lat];
      this.drawVertexLayer.updateData(featureCollection(this.pointFeatures));
      this.drawMidVertexLayer.updateData(featureCollection(this.pointFeatures));
      this.editPolygonVertex(id, vertex);
      this.drawRender.updateData(
        featureCollection([this.currentFeature as Feature]),
      );
    }

    return featureCollection([]);
  }

  protected onDraw = () => {
    this.drawVertexLayer.on('mousemove', (e: any) => {
      this.setCursor('pointer');
    });
    this.drawVertexLayer.on('mouseout', () => {
      this.setCursor('crosshair');
    });
    this.drawVertexLayer.on('click', () => {
      this.resetCursor();
      this.drawFinish();
    });
  };

  protected showOtherLayer() {
    return null;
  }

  protected hideOtherLayer() {
    return null;
  }

  protected addMidLayerEvent(mode: DrawModes[any]) {
    switch (mode) {
      case DrawModes.DIRECT_SELECT:
        this.drawMidVertexLayer.update(featureCollection(this.pointFeatures));
        this.drawMidVertexLayer.show();
        break;
      case DrawModes.STATIC:
        this.drawMidVertexLayer.hide();
        break;
    }
  }

  private editPolygonVertex(id: number, vertex: ILngLat) {
    const feature = this.currentFeature as Feature<Geometries, Properties>;
    const type = feature.geometry.type;
    if (type === 'Polygon') {
      const coords = feature.geometry.coordinates as Position[][];
      coords[0][id] = [vertex.lng, vertex.lat];
      if (-id === 0) {
        coords[0][coords[0].length - 1] = [vertex.lng, vertex.lat];
      }
    } else {
      const coords = feature.geometry.coordinates as Position[];
      coords[id] = [vertex.lng, vertex.lat];
    }
    this.setCurrentFeature(feature);
    this.drawRender.updateData(
      featureCollection([this.currentFeature as Feature]),
    );
  }
}
/**
 * draw 端点响应事件
 * select Polyon 响应事件
 * edit 端点 中心点响应事件
 */
