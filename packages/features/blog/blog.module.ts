import { Module, type OnModuleInit } from "@nestjs/common";
import { BlogController } from "./controller";
import { BlogService } from "./service";
import { setBlogService } from "./service-registry";

@Module({
  controllers: [BlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule implements OnModuleInit {
  constructor(private readonly blogService: BlogService) {}

  onModuleInit() {
    setBlogService(this.blogService);
  }
}
