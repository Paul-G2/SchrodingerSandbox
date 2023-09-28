/**
 * @classdesc
 * This class encapsulates a set of obstacles.
 * 
 */
ObstacleSet = class
{
    /**
	 * @constructor
     *
     * @param {App} app - The App instance.
     */
    constructor(app)
	{
        this.app = app;
		this.obstacles = [];

        // Allowed obstacle ids are [2, 3, ..., 255]. (0 is reseverd for background, a
        // nd 1 is for the wavefunction.)
        this.availableIds = Array.from({length: 254}, (_, index) => index + 2);
	}


    /**
     * Adds an obstacle to the set, and assigns it a unique id.
     * 
     * @param {Obstacle} obstacle - The obstacle to add.
     * @param {Boolean} notify - whether to notify the engine about the change.
     */
    add(obstacle, notify=true)
    {
        obstacle.id = this.availableIds.pop();
        obstacle.update();
        this.obstacles.push(obstacle);
        if (notify) {
            this.app.engine.onObstaclesChanged();
        }
    }


    /**
     * Removes an obstacle from the set, and recycles its id.
     * 
     * @param {Obstacle} obstacle - The obstacle to remove.
     * @param {Boolean} notify - whether to notify the engine about the change.
     */
    remove(obstacle, notify=true)
    {
        this.obstacles = this.obstacles.filter(ob => ob != obstacle);
        this.availableIds.push(obstacle.id);
        if (notify) {
            this.app.engine.onObstaclesChanged();
        }
    }


    /**
     * Indicates whether the ObstacleSet contains an Obstacle with the given id.
     * @param {Number} id - the id to check.
     * 
     */
    contains(id)
    {
        return this.obstacles.some(ob => ob.id === id);
    }


    /**
     * Gets the Obstacle with the given id.
     * @param {Number} id - the id to look for.
     * 
     */
    get(id)
    {
        return this.obstacles.find(ob => ob.id === id)
    }


    /**
     * Gets the triangle vertices (including their attributes) 
     * of all obstacles in the set.
     * 
     */
    getTriangleVertices()
    {
        let vertices = [];
        for (let ob of this.obstacles) {
            vertices = vertices.concat( ob.getTriangleVertices() );
        }
        return vertices;
    }

    /**
     * Gets the total number of triangles in the set.
     * 
     */
    numTriangles()
    {
        let sum = 0;
        for (let ob of this.obstacles) {
            sum += ob.triangleVertices.length;
        }
        return sum / (3*Obstacle.AttrsPerVertex);;
    }

}