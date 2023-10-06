"use strict";

import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import * as d3 from "d3";
import {blue} from "./../assets/blue";
import {yellow} from "./../assets/yellow";
import {red} from "./../assets/red";
import {key} from "./../assets/key";
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;

export class Visual implements IVisual {
    private svg: Selection<SVGElement>;
    private barcontainer: Selection<SVGElement>;
    private host: IVisualHost;

    constructor(options: VisualConstructorOptions) {
        // console.log("cunstructor");
        this.host = options.host;
        this.svg =  d3.select(options.element)
            .append('svg');
        this.barcontainer = this.svg.append("g");
    }

    public update(options: VisualUpdateOptions) {
        if(
            !options.dataViews 
            || !options.dataViews[0] 
            || !options.dataViews[0].categorical
            || !options.dataViews[0].categorical.categories
            || !options.dataViews[0].categorical.values
        ){
            this.svg.selectAll("*").remove()
            console.log("stop update!")
            this.barcontainer.selectAll(".bar").remove()
            return
        }
        
        console.log(options)
        console.log(options.type)

        var cat_data = options.dataViews[0].categorical; 
        var category = cat_data.categories[0];

        var width: number = options.viewport.width;
        var height: number = options.viewport.height;
        this.svg.attr("width", width).attr("height", height);

        this.svg.selectAll("*").remove()

        const x0 = width/2;
        const y0 = height/2;
        const R = d3.min([width, height])*0.425
        const N = category.values.length;
        const n_levels = 10

        // spider web
        for(let i=0; i<=n_levels; i++){
            var points = this.compute_regular_polygon_points(N, R*i/10, x0, y0)

            this.svg.append("polygon")
                .classed("poly", true)
                .attr("points", points.map(p => `${p.x},${p.y}`).join(" "))
                .attr("stroke", "grey").attr("stroke-width", i==n_levels ? 2 : 1)
                .attr("fill", "none")

            if(i<10) continue

            for(var j in points){
                const xp = points[j].x
                const yp = points[j].y
                
                // bullets
                this.svg.append("circle")
                    .classed("dot", true)
                    .attr("cx", xp).attr("cy", yp)
                    .attr("r", 4).attr("fill", "grey")
                
                // web radius
                this.svg.append("line").classed("radius", true)
                    .attr("x1", x0).attr("y1", y0)
                    .attr("x2", xp).attr("y2", yp)
                    .attr("stroke", "grey").attr("stroke-width", 1)
            }
        }

        // data labels
        const labels_R = R + d3.min([d3.min([width, height])*0.1, 20])
        // console.log( d3.min([d3.min([width, height])*0.1, 50]))
        var label_points = this.compute_regular_polygon_points(N, labels_R, x0, y0)
        for(let i=0; i<N; i++){
            const xp = label_points[i].x
            const yp = label_points[i].y

            this.svg.append("text")
                .classed("label", true)
                .attr("x", xp)
                .attr("y", yp)
                .text(category.values[i] as string)
                .attr("fill", "black")
                .style("text-anchor", "middle")
        }

        // radar "axis"
        var extreme_points = this.compute_regular_polygon_points(N, R, x0, y0)
        var first_bullet = extreme_points[0]
        var x1 = first_bullet.x
        var y1 = first_bullet.y

        for(let i=0; i<=n_levels; i++){
            var lambda = i/n_levels;
            const xp = lambda*x1 + (1-lambda)*x0
            const yp = lambda*y1 + (1-lambda)*y0

            this.svg.append("text")
                .classed("label", true)
                .attr("x", xp)
                .attr("y", yp)
                .attr("dx", 20)
                .text(`${lambda*100}%`)
                .attr("fill", "black")
                .style("text-anchor", "middle")
        }

        // radar chart
        for(var series in [1, 0]){
            var datavalue = cat_data.values[series];
            var color = series == "0" ? "red" : "#1E3246";
            var fill = series == "0" ? "red" : "#1E3246";
            var opacity = series == "0" ? "80%" : "15%";

            var data_points = []
            const max_value = d3.max(datavalue.values, v => v as number)
            // per convenzione min_value = 0 sempre
            for(let j=0; j<N; j++){
                const xp = extreme_points[j].x
                const yp = extreme_points[j].y
    
                let val = datavalue.values[j] as number
                let lambda = val/max_value
    
                data_points.push(
                    {
                        "x": lambda*xp + (1-lambda)*x0,
                        "y": lambda*yp + (1-lambda)*y0
                    }
                )
            }
    
            this.svg.append("polygon")
                .classed("poly", true)
                .attr("points", data_points.map(p => `${p.x},${p.y}`).join(" "))
                .attr("stroke", color)
                .attr("stroke-width", 3)
                .attr("fill", fill)
                .attr("fill-opacity", opacity)
        }

        const symbols_size = R / 8

        // flags
        const flag_R = R - symbols_size
        const flag_points = this.compute_regular_polygon_points(N, flag_R, x0, y0)
        for(let i=0; i<N; i++){
            const xf = flag_points[i].x
            const yf = flag_points[i].y

            var flag;
            if(i == 0)
                flag = blue
            else if (i == 1 || i == 2)
                flag = yellow
            else if (i == 22)
                flag = red
            else
                continue
            
            this.svg.append('svg:image')
                .attr('class', 'iconUserTotal')
                .attr('width', symbols_size)
                .attr('height', symbols_size)
                .attr('x', xf-symbols_size/2)
                .attr('y', yf-symbols_size/2)
                .attr('href', 'data:image/png;base64,' + flag)
        }

        // depot
        const depot_R = R - symbols_size*2.5
        const depot_points = this.compute_regular_polygon_points(N, depot_R, x0, y0)
        for(let i=0; i<N; i++){
            const xf = depot_points[i].x
            const yf = depot_points[i].y

            if(!(i==2 || i == 4 || i == 9 || i ==17))
                continue

            this.svg.append('svg:image')
                .attr('class', 'iconUserTotal')
                .attr('width', symbols_size)
                .attr('height', symbols_size)
                .attr('x', xf-symbols_size/2)
                .attr('y', yf-symbols_size/2)
                .attr('href', 'data:image/png;base64,' + key)
        }
    }

    private compute_regular_polygon_points(n: number, r: number, x0: number, y0: number){
        var points = []
        for(let i=0; i<n; i++){
            points.push({"x": x0+r*Math.sin(2*Math.PI*i/n), "y": y0-r*Math.cos(2*Math.PI*i/n)})
        }        
        return points
    }
}

