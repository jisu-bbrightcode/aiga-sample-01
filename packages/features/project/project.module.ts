import { Module, type OnModuleInit } from "@nestjs/common";
import { ProjectController } from "./controller";
import { ProjectService } from "./service";
import { setProjectService } from "./service-registry";

@Module({
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule implements OnModuleInit {
  constructor(private readonly projectService: ProjectService) {}

  onModuleInit() {
    setProjectService(this.projectService);
  }
}
